import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { XMarkIcon, ExclamationTriangleIcon, CheckCircleIcon, InformationCircleIcon } from "./Icons";

type DialogType = "confirm" | "alert" | "info" | "warning" | "danger";

interface DialogConfig {
  title: string;
  message: string | ReactNode;
  type?: DialogType;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
}

interface DialogContextType {
  showDialog: (config: DialogConfig) => Promise<boolean>;
  confirm: (message: string, title?: string) => Promise<boolean>;
  alert: (message: string, title?: string) => Promise<void>;
}

const DialogContext = createContext<DialogContextType | null>(null);

const typeConfig: Record<DialogType, { icon: typeof CheckCircleIcon; iconColor: string; buttonColor: string }> = {
  confirm: {
    icon: InformationCircleIcon,
    iconColor: "text-blue-500",
    buttonColor: "bg-blue-600 hover:bg-blue-700",
  },
  alert: {
    icon: ExclamationTriangleIcon,
    iconColor: "text-amber-500",
    buttonColor: "bg-amber-600 hover:bg-amber-700",
  },
  info: {
    icon: InformationCircleIcon,
    iconColor: "text-sky-500",
    buttonColor: "bg-sky-600 hover:bg-sky-700",
  },
  warning: {
    icon: ExclamationTriangleIcon,
    iconColor: "text-amber-500",
    buttonColor: "bg-amber-600 hover:bg-amber-700",
  },
  danger: {
    icon: ExclamationTriangleIcon,
    iconColor: "text-red-500",
    buttonColor: "bg-red-600 hover:bg-red-700",
  },
};

export const DialogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<DialogConfig | null>(null);
  const [resolver, setResolver] = useState<((value: boolean) => void) | null>(null);

  const showDialog = useCallback((dialogConfig: DialogConfig): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfig(dialogConfig);
      setResolver(() => resolve);
      setIsOpen(true);
    });
  }, []);

  const confirm = useCallback(
    (message: string, title: string = "Xác nhận"): Promise<boolean> => {
      return showDialog({
        title,
        message,
        type: "confirm",
        confirmText: "Xác nhận",
        cancelText: "Hủy",
      });
    },
    [showDialog]
  );

  const alert = useCallback(
    async (message: string, title: string = "Thông báo"): Promise<void> => {
      await showDialog({
        title,
        message,
        type: "alert",
        confirmText: "OK",
      });
    },
    [showDialog]
  );

  const handleConfirm = async () => {
    if (config?.onConfirm) {
      await config.onConfirm();
    }
    resolver?.(true);
    setIsOpen(false);
    setConfig(null);
    setResolver(null);
  };

  const handleCancel = () => {
    config?.onCancel?.();
    resolver?.(false);
    setIsOpen(false);
    setConfig(null);
    setResolver(null);
  };

  const currentType = config?.type || "confirm";
  const { icon: IconComponent, iconColor, buttonColor } = typeConfig[currentType];

  return (
    <DialogContext.Provider value={{ showDialog, confirm, alert }}>
      {children}
      
      {/* Dialog Overlay */}
      {isOpen && config && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCancel();
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="dialog-title"
        >
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 dark:border-slate-700">
              <div className={`flex-shrink-0 ${iconColor}`}>
                <IconComponent className="w-6 h-6" />
              </div>
              <h3 
                id="dialog-title"
                className="text-lg font-semibold text-gray-900 dark:text-white flex-1"
              >
                {config.title}
              </h3>
              <button
                onClick={handleCancel}
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                aria-label="Đóng"
              >
                <XMarkIcon className="w-5 h-5 text-gray-500 dark:text-slate-400" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-4">
              <div className="text-gray-600 dark:text-slate-300">
                {config.message}
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50 dark:bg-slate-900/50">
              {config.cancelText && (
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 rounded-lg transition-colors"
                >
                  {config.cancelText}
                </button>
              )}
              <button
                onClick={handleConfirm}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${buttonColor}`}
                autoFocus
              >
                {config.confirmText || "OK"}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
};

export const useDialog = (): DialogContextType => {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error("useDialog must be used within a DialogProvider");
  }
  return context;
};

export default DialogProvider;
