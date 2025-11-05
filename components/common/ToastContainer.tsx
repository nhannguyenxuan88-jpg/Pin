import React from 'react';

export type ToastMessage = {
  id: string;
  title?: string;
  message: string;
  type?: ToastType;
};

export type ToastType = 'error' | 'info' | 'success' | 'warn';

const ToastItem: React.FC<{t: ToastMessage, onClose: (id: string)=>void}> = ({ t, onClose }) => {
  const bg = t.type === 'error' ? 'bg-red-600' : t.type === 'success' ? 'bg-green-600' : 'bg-slate-800';
  return (
    <div className={`max-w-sm w-full ${bg} text-white shadow-lg rounded-md pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden`}>
      <div className="p-3">
        <div className="flex items-start">
          <div className="flex-1">
            {t.title && <div className="font-semibold">{t.title}</div>}
            <div className="text-sm mt-1">{t.message}</div>
          </div>
          <div className="ml-4 pl-2">
            <button onClick={() => onClose(t.id)} className="text-white hover:opacity-80">✕</button>
          </div>
        </div>
      </div>
    </div>
  );
};

const ToastContainer: React.FC<{ toasts: ToastMessage[]; removeToast: (id: string)=>void }> = ({ toasts, removeToast }) => {
  return (
    <div aria-live="assertive" className="fixed inset-0 flex items-end px-4 py-6 pointer-events-none sm:p-6 z-50">
      <div className="w-full flex flex-col items-end space-y-2">
        {toasts.map(t => (
          <ToastItem key={t.id} t={t} onClose={removeToast} />
        ))}
      </div>
    </div>
  );
};

export default ToastContainer;
