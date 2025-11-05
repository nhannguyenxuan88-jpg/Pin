import React from 'react';
import { usePermission } from '../../lib/hooks/usePermission';

interface ProtectedButtonProps {
  module: string;
  action: string;
  app?: 'motocare' | 'pincorp';
  onClick?: () => void;
  className?: string;
  children: React.ReactNode;
  disabled?: boolean;
}

export default function ProtectedButton({
  module,
  action,
  app = 'motocare',
  onClick,
  className = '',
  children,
  disabled = false
}: ProtectedButtonProps) {
  const { hasPermission, isLoading } = usePermission(module, action, { app });

  if (isLoading) {
    return (
      <button disabled className={`${className} opacity-50 cursor-not-allowed`}>
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2 inline-block"></div>
        Loading...
      </button>
    );
  }

  if (!hasPermission) {
    return null; // Hide button completely if no permission
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={className}
    >
      {children}
    </button>
  );
}