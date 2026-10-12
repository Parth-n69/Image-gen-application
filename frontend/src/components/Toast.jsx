import { createContext, useContext, useState, useCallback, useRef } from 'react';
import './Toast.css';

const ToastContext = createContext({
  showToast: () => {},
  showAutocorrect: () => {},
});

export function ToastProvider({ children }) {
  const [toast, setToast] = useState({ message: '', type: 'info', visible: false });
  const [autocorrect, setAutocorrect] = useState({ original: '', corrected: '', visible: false });
  const toastTimeoutRef = useRef(null);
  const autocorrectTimeoutRef = useRef(null);

  const showToast = useCallback((message, type = 'info', duration = 3000) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ message, type, visible: true });

    toastTimeoutRef.current = setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, duration);
  }, []);

  const showAutocorrect = useCallback((original, corrected, duration = 2500) => {
    if (autocorrectTimeoutRef.current) clearTimeout(autocorrectTimeoutRef.current);
    setAutocorrect({ original, corrected, visible: true });

    autocorrectTimeoutRef.current = setTimeout(() => {
      setAutocorrect((prev) => ({ ...prev, visible: false }));
    }, duration);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, showAutocorrect }}>
      {children}

      {/* Global Toast */}
      <div
        className={`global-toast ${toast.type === 'error' ? 'error' : ''} ${
          toast.visible ? 'show' : ''
        }`}
        role="status"
        aria-live="polite"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          width="16"
          height="16"
          aria-hidden="true"
        >
          {toast.type === 'error' ? (
            <>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </>
          ) : (
            <>
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </>
          )}
        </svg>
        <span>{toast.message}</span>
      </div>

      {/* Autocorrect Toast */}
      <div
        className={`autocorrect-toast ${autocorrect.visible ? 'show' : ''}`}
        role="status"
        aria-live="polite"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          width="14"
          height="14"
          aria-hidden="true"
        >
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
        </svg>
        <span>
          Corrected &quot;<strong>{autocorrect.original}</strong>&quot; → &quot;
          <strong>{autocorrect.corrected}</strong>&quot;
        </span>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
