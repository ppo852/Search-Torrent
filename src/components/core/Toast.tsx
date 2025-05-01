import React, { useEffect, useState } from 'react';

interface ToastProps {
  message: string;
  duration?: number;
  onClose?: () => void;
}

export function Toast({ message, duration = 3000, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      onClose?.();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-fade-in">
      <div className="bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center">
        <span>{message}</span>
        <button
          onClick={() => {
            setIsVisible(false);
            onClose?.();
          }}
          className="ml-4 hover:text-gray-200"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
