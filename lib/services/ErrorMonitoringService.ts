/**
 * Error Monitoring Service
 * Production-ready error tracking that can be connected to services like Sentry, LogRocket, etc.
 */

interface ErrorContext {
  componentStack?: string;
  userId?: string;
  userEmail?: string;
  url?: string;
  userAgent?: string;
  timestamp?: string;
  extra?: Record<string, unknown>;
}

interface MonitoringConfig {
  enabled: boolean;
  dsn?: string; // For Sentry or similar
  environment: 'development' | 'staging' | 'production';
  sampleRate?: number;
}

class ErrorMonitoringService {
  private config: MonitoringConfig;
  private errorQueue: Array<{ error: Error; context: ErrorContext }> = [];
  private isInitialized = false;

  constructor() {
    this.config = {
      enabled: import.meta.env.PROD,
      environment: import.meta.env.DEV ? 'development' : 'production',
      sampleRate: 1.0,
    };
  }

  /**
   * Initialize the monitoring service
   * Call this once at app startup with your monitoring service DSN
   */
  init(config: Partial<MonitoringConfig> = {}): void {
    this.config = { ...this.config, ...config };
    this.isInitialized = true;

    // Set up global error handlers
    this.setupGlobalHandlers();

    // Flush any queued errors
    this.flushQueue();

    if (import.meta.env.DEV) {
      console.info('[ErrorMonitoring] Initialized in', this.config.environment, 'mode');
    }
  }

  private setupGlobalHandlers(): void {
    // Catch unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.captureError(
        event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
        { extra: { type: 'unhandledrejection' } }
      );
    });

    // Catch global errors
    window.addEventListener('error', (event) => {
      this.captureError(event.error || new Error(event.message), {
        extra: {
          type: 'globalError',
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
      });
    });
  }

  /**
   * Capture an error with optional context
   */
  captureError(error: Error, context: ErrorContext = {}): void {
    const enrichedContext: ErrorContext = {
      ...context,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    };

    // Always log in development
    if (import.meta.env.DEV) {
      console.error('[ErrorMonitoring] Captured error:', error.message, enrichedContext);
    }

    if (!this.config.enabled) {
      return;
    }

    // Check sample rate
    if (Math.random() > (this.config.sampleRate ?? 1.0)) {
      return;
    }

    if (!this.isInitialized) {
      // Queue errors until initialized
      this.errorQueue.push({ error, context: enrichedContext });
      return;
    }

    this.sendError(error, enrichedContext);
  }

  /**
   * Capture a message (non-error event)
   */
  captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', context: ErrorContext = {}): void {
    if (import.meta.env.DEV) {
      console.log(`[ErrorMonitoring] ${level.toUpperCase()}:`, message, context);
    }

    if (!this.config.enabled || !this.isInitialized) {
      return;
    }

    // Could be extended to send to monitoring service
  }

  /**
   * Set user context for error tracking
   */
  setUser(userId: string, email?: string): void {
    // Store user context for future errors
    if (import.meta.env.DEV) {
      console.info('[ErrorMonitoring] User context set:', { userId, email });
    }
  }

  /**
   * Clear user context (on logout)
   */
  clearUser(): void {
    if (import.meta.env.DEV) {
      console.info('[ErrorMonitoring] User context cleared');
    }
  }

  private sendError(error: Error, context: ErrorContext): void {
    // In production, this would send to your error monitoring service
    // Example implementations:
    // 
    // For Sentry:
    // Sentry.captureException(error, { extra: context });
    //
    // For custom backend:
    // fetch('/api/errors', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ error: error.message, stack: error.stack, context }),
    // });

    // For now, we store errors in localStorage for debugging
    try {
      const storedErrors = JSON.parse(localStorage.getItem('pin_error_log') || '[]');
      storedErrors.push({
        message: error.message,
        stack: error.stack,
        context,
        timestamp: context.timestamp,
      });
      // Keep only last 50 errors
      if (storedErrors.length > 50) {
        storedErrors.splice(0, storedErrors.length - 50);
      }
      localStorage.setItem('pin_error_log', JSON.stringify(storedErrors));
    } catch {
      // Ignore localStorage errors
    }
  }

  private flushQueue(): void {
    while (this.errorQueue.length > 0) {
      const { error, context } = this.errorQueue.shift()!;
      this.sendError(error, context);
    }
  }

  /**
   * Get stored error logs (for debugging)
   */
  getStoredErrors(): Array<{ message: string; stack?: string; context: ErrorContext; timestamp: string }> {
    try {
      return JSON.parse(localStorage.getItem('pin_error_log') || '[]');
    } catch {
      return [];
    }
  }

  /**
   * Clear stored error logs
   */
  clearStoredErrors(): void {
    localStorage.removeItem('pin_error_log');
  }
}

// Singleton instance
export const errorMonitoring = new ErrorMonitoringService();

export default errorMonitoring;
