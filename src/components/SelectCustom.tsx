"use client";

import { useState, useRef, useEffect } from "react";
import { Icone } from "./Icone";

interface SelectCustomProps {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  className?: string;
  style?: React.CSSProperties;
}

export function SelectCustom({ value, options, onChange, className, style }: SelectCustomProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative", ...style }} className={className}>
      <button
        type="button"
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
          cursor: "pointer",
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

      {open && (
        <div
          className="elev-md"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            zIndex: 100,
            background: "var(--color-surface)",
            border: "1px solid var(--color-divider)",
            borderRadius: 12,
            padding: 4,
            display: "flex",
            flexDirection: "column",
            gap: 2,
            maxHeight: 280,
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
        </div>
      )}
    </div>
  );
}
