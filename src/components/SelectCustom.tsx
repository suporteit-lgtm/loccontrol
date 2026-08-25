"use client";

import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { Icone } from "./Icone";

interface SelectCustomProps {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
}

const GAP = 6;
const MARGEM = 8;
const ALTURA_MAX_PAINEL = 280;

export function SelectCustom({ value, options, onChange, className, style, disabled }: SelectCustomProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; abrirPraCima: boolean } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const painelRef = useRef<HTMLDivElement>(null);

  // posição calculada em viewport (fixed) — o painel vira portal em <body>,
  // então nunca estica o scroll de nenhum container ancestral (tabela, card…).
  useLayoutEffect(() => {
    if (!open || !wrapRef.current) return;
    const r = wrapRef.current.getBoundingClientRect();
    const espacoAbaixo = window.innerHeight - r.bottom;
    const abrirPraCima = espacoAbaixo < ALTURA_MAX_PAINEL + GAP && r.top > espacoAbaixo;
    const largura = Math.max(r.width, 160);
    setPos({
      top: abrirPraCima ? r.top - GAP : r.bottom + GAP,
      left: Math.min(r.left, window.innerWidth - largura - MARGEM),
      width: largura,
      abrirPraCima,
    });
  }, [open]);

  useEffect(() => {
    function fechar(event: MouseEvent) {
      const alvo = event.target as Node;
      if (wrapRef.current?.contains(alvo) || painelRef.current?.contains(alvo)) return;
      setOpen(false);
    }
    function fecharNoScroll() {
      setOpen(false);
    }
    document.addEventListener("mousedown", fechar);
    // scroll de qualquer ancestral (não só a janela) invalida a posição calculada
    window.addEventListener("scroll", fecharNoScroll, true);
    window.addEventListener("resize", fecharNoScroll);
    return () => {
      document.removeEventListener("mousedown", fechar);
      window.removeEventListener("scroll", fecharNoScroll, true);
      window.removeEventListener("resize", fecharNoScroll);
    };
  }, []);

  return (
    <div ref={wrapRef} style={{ position: "relative", opacity: disabled ? 0.5 : 1, ...style }} className={className}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "transparent",
          border: "none",
          padding: 0,
          color: "inherit",
          font: "inherit",
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {value}
        </span>
        <div
          style={{
            flex: "none",
            marginLeft: 8,
            transition: "transform 0.2s",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            color: "color-mix(in srgb, var(--color-text) 50%, transparent)"
          }}
        >
          <Icone nome="chevron" tamanho={16} />
        </div>
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={painelRef}
            className="elev-md hide-scrollbar"
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              width: pos.width,
              maxWidth: 260,
              transform: pos.abrirPraCima ? "translateY(-100%)" : "none",
              zIndex: 100,
              background: "var(--color-surface)",
              border: "1px solid var(--color-divider)",
              borderRadius: 12,
              padding: 4,
              display: "flex",
              flexDirection: "column",
              gap: 2,
              maxHeight: ALTURA_MAX_PAINEL,
              overflowY: "auto",
            }}
          >
            {options.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
                style={{
                  textAlign: "left",
                  padding: "8px 12px",
                  background: opt === value ? "color-mix(in srgb, var(--color-accent) 15%, transparent)" : "transparent",
                  color: opt === value ? "var(--color-accent)" : "var(--color-text)",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: opt === value ? 600 : 400,
                  cursor: "pointer",
                  transition: "background 0.1s",
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={(e) => {
                  if (opt !== value) {
                    e.currentTarget.style.background = "color-mix(in srgb, var(--color-text) 5%, transparent)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (opt !== value) {
                    e.currentTarget.style.background = "transparent";
                  }
                }}
              >
                {opt}
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}
