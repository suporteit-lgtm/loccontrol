"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

export type ToastTipo = "ok" | "erro" | "info";

interface ToastState {
  msg: string;
  undo?: () => void;
  tipo: ToastTipo;
}

const CORES: Record<ToastTipo, { icone: string; cor: string }> = {
  ok: { icone: "✓", cor: "var(--ok)" },
  erro: { icone: "✕", cor: "var(--danger)" },
  info: { icone: "", cor: "var(--color-neutral-500)" },
};

const ToastContext = createContext<{
  toast: (msg: string, undo?: (() => void) | ToastTipo, tipo?: ToastTipo) => void;
}>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [atual, setAtual] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // toast(msg), toast(msg, undo) ou toast(msg, "ok" | "erro" | "info", undo?)
  const toast = useCallback((msg: string, undoOuTipo?: (() => void) | ToastTipo, tipo?: ToastTipo) => {
    const ehTipo = typeof undoOuTipo === "string";
    if (timer.current) clearTimeout(timer.current);
    setAtual({
      msg,
      undo: ehTipo ? undefined : undoOuTipo,
      tipo: (ehTipo ? undoOuTipo : tipo) ?? "info",
    });
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
            left: 20,
            zIndex: 60,
            background: "var(--color-neutral-900)",
            color: "var(--color-neutral-100)",
            padding: "10px 16px",
            display: "flex",
            alignItems: "center",
            gap: 14,
            fontSize: 14,
            maxWidth: "calc(100vw - 40px)",
            borderRadius: 10,
            borderLeft: `3px solid ${CORES[atual.tipo].cor}`,
            animation: "toast-in 0.22s cubic-bezier(0.2, 0.9, 0.3, 1.2) both",
          }}
        >
          {CORES[atual.tipo].icone && (
            <span style={{ color: CORES[atual.tipo].cor, fontWeight: 700, flex: "none" }}>
              {CORES[atual.tipo].icone}
            </span>
          )}
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
