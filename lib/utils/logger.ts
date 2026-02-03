/**
 * Production-ready Logger Utility
 * - In development: Shows all logs
 * - In production: Only shows errors and warnings (optional)
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
  enableInProduction: boolean;
  minLevel: LogLevel;
  prefix?: string;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const isDevelopment = import.meta.env.DEV;

const defaultConfig: LoggerConfig = {
  enableInProduction: false,
  minLevel: isDevelopment ? 'debug' : 'error',
};

class Logger {
  private config: LoggerConfig;
  private prefix: string;

  constructor(prefix: string = '', config: Partial<LoggerConfig> = {}) {
    this.prefix = prefix;
    this.config = { ...defaultConfig, ...config };
  }

  private shouldLog(level: LogLevel): boolean {
    if (!isDevelopment && !this.config.enableInProduction) {
      // In production, only log errors
      return level === 'error';
    }
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.minLevel];
  }

  private formatMessage(message: string): string {
    if (this.prefix) {
      return `[${this.prefix}] ${message}`;
    }
    return message;
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage(message), ...args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage(message), ...args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage(message), ...args);
    }
  }

  error(message: string, ...args: unknown[]): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage(message), ...args);
    }
  }

  /**
   * Create a child logger with a specific prefix
   */
  child(prefix: string): Logger {
    const newPrefix = this.prefix ? `${this.prefix}:${prefix}` : prefix;
    return new Logger(newPrefix, this.config);
  }
}

// Default logger instance
export const logger = new Logger();

// Pre-configured loggers for different modules
export const createLogger = (prefix: string, config?: Partial<LoggerConfig>): Logger => {
  return new Logger(prefix, config);
};

// Specific module loggers
export const auditLogger = createLogger('Audit');
export const productionLogger = createLogger('Production');
export const salesLogger = createLogger('Sales');
export const syncLogger = createLogger('Sync');
export const serviceLogger = createLogger('Service');

export default logger;
