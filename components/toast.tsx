"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle, Info, XCircle, X } from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

// Global toast store
let toastId = 0;
const toastListeners: ((toast: Toast) => void)[] = [];
const removeListeners: ((id: string) => void)[] = [];

export function showToast(message: string, type: ToastType = "info", duration = 4000) {
  const id = `toast-${++toastId}`;
  const toast: Toast = { id, message, type, duration };
  toastListeners.forEach((listener) => listener(toast));

  if (duration > 0) {
    setTimeout(() => {
      removeListeners.forEach((listener) => listener(id));
    }, duration);
  }
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const addToast = (toast: Toast) => {
      setToasts((prev) => [...prev, toast]);
    };

    const removeToast = (id: string) => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    };

    toastListeners.push(addToast);
    removeListeners.push(removeToast);

    return () => {
      toastListeners.splice(toastListeners.indexOf(addToast), 1);
      removeListeners.splice(removeListeners.indexOf(removeToast), 1);
    };
  }, []);

  return toasts;
}

function getIcon(type: ToastType) {
  switch (type) {
    case "success":
      return <CheckCircle size={20} className="text-green-600" />;
    case "error":
      return <XCircle size={20} className="text-red-600" />;
    case "warning":
      return <AlertCircle size={20} className="text-yellow-600" />;
    case "info":
      return <Info size={20} className="text-blue-600" />;
  }
}

function getStyles(type: ToastType) {
  switch (type) {
    case "success":
      return "border-green-200 bg-green-50";
    case "error":
      return "border-red-200 bg-red-50";
    case "warning":
      return "border-yellow-200 bg-yellow-50";
    case "info":
      return "border-blue-200 bg-blue-50";
  }
}

export function ToastContainer() {
  const toasts = useToast();

  const removeToast = (id: string) => {
    removeListeners.forEach((listener) => listener(id));
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-md">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-start gap-3 p-4 rounded-lg border ${getStyles(
            toast.type
          )} animate-in fade-in slide-in-from-bottom-4 duration-300`}
        >
          {getIcon(toast.type)}
          <p className="flex-1 text-sm font-medium text-gray-900">{toast.message}</p>
          <button
            onClick={() => removeToast(toast.id)}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
