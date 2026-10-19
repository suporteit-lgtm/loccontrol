"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

interface ToastState {
  msg: string;
  undo?: () => void;
}

const ToastContext = createContext<{
  toast: (msg: string, undo?: () => void) => void;
}>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [atual, setAtual] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback((msg: string, undo?: () => void) => {
    if (timer.current) clearTimeout(timer.current);
    setAtual({ msg, undo });
    timer.current = setTimeout(() => setAtual(null), 8000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {atual && (
        <div
          className="elev-lg"
          role="status"
          style={{
            position: "fixed",
            bottom: 20,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 60,
            background: "var(--color-neutral-900)",
            color: "var(--color-neutral-100)",
            padding: "10px 16px",
            display: "flex",
            alignItems: "center",
            gap: 14,
            fontSize: 14,
            maxWidth: "calc(100vw - 32px)",
            borderRadius: 10,
          }}
        >
          <span>{atual.msg}</span>
          {atual.undo && (
            <button
              onClick={() => {
                atual.undo?.();
                setAtual(null);
              }}
              style={{
                background: "none",
                border: "none",
                color: "var(--color-accent-300)",
                fontFamily: "var(--font-body)",
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
                padding: 0,
              }}
            >
              Desfazer
            </button>
          )}
        </div>
      )}
    </ToastContext.Provider>
  );
}
