"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { quandoBR } from "@/lib/format";
import type { Auditoria } from "@/lib/types";

function FilterSelect({ value, onChange, options, defaultLabel, placeholder }: { value: string, onChange: (v: string) => void, options: string[], defaultLabel: string, placeholder: string }) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const dRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const clickFora = (e: MouseEvent) => {
      if (dRef.current && !dRef.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", clickFora);
    return () => document.removeEventListener("mousedown", clickFora);
  }, []);

  const opts = options.filter(o => o.toLowerCase().includes(busca.toLowerCase()));
  const labelText = (value === "todos" || value === "todas") ? defaultLabel : value;
  const isDefault = value === "todos" || value === "todas";

  return (
    <div style={{ position: "relative", minWidth: 260 }} ref={dRef}>
      <div 
        onClick={() => setAberto(!aberto)}
        style={{
          width: "100%", fontSize: 14, padding: "12px 20px", borderRadius: 999,
          background: "color-mix(in srgb, var(--color-surface) 60%, transparent)",
          border: `1px solid color-mix(in srgb, var(--color-text) ${aberto ? "30%" : "10%"}, transparent)`,
          color: "var(--color-text)", cursor: "pointer", transition: "all 0.2s",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", opacity: isDefault ? 0.7 : 1, fontWeight: isDefault ? 400 : 600 }}>
          {labelText}
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", opacity: 0.5, transform: aberto ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>
      {aberto && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, marginTop: 8, zIndex: 50,
          background: "var(--color-surface)", borderRadius: 16, border: "1px solid color-mix(in srgb, var(--color-text) 10%, transparent)",
          boxShadow: "0 12px 48px rgba(0,0,0,0.5)", display: "flex", flexDirection: "column", overflow: "hidden"
        }}>
          <div style={{ padding: "12px 12px 8px 12px" }}>
            <input 
              autoFocus
              placeholder={placeholder}
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              style={{
                width: "100%", padding: "10px 14px", borderRadius: 10, fontSize: 13,
                background: "color-mix(in srgb, var(--color-text) 5%, transparent)",
                border: "1px solid color-mix(in srgb, var(--color-text) 10%, transparent)",
                color: "var(--color-text)", outline: "none"
              }}
            />
          </div>
          <div style={{ maxHeight: 240, overflowY: "auto", padding: "0 8px 8px 8px", display: "flex", flexDirection: "column", gap: 2 }}>
            <div 
              onClick={() => { onChange(defaultLabel.includes("pessoas") ? "todas" : "todos"); setAberto(false); setBusca(""); }}
              style={{
                padding: "10px 12px", borderRadius: 8, fontSize: 13, cursor: "pointer",
                background: isDefault ? "color-mix(in srgb, var(--color-accent) 15%, transparent)" : "transparent",
                color: isDefault ? "var(--color-accent)" : "var(--color-text)",
                fontWeight: isDefault ? 600 : 400,
                transition: "background 0.2s"
              }}
              onMouseEnter={(e) => { if (!isDefault) e.currentTarget.style.background = "color-mix(in srgb, var(--color-text) 5%, transparent)"; }}
              onMouseLeave={(e) => { if (!isDefault) e.currentTarget.style.background = "transparent"; }}
            >
              {defaultLabel}
            </div>
            {opts.length === 0 ? (
               <div style={{ padding: "12px", fontSize: 13, color: "color-mix(in srgb, var(--color-text) 50%, transparent)", textAlign: "center" }}>
                 Nenhum resultado
               </div>
            ) : (
              opts.map((o) => (
                <div 
                  key={o}
                  onClick={() => { onChange(o); setAberto(false); setBusca(""); }}
                  style={{
                    padding: "10px 12px", borderRadius: 8, fontSize: 13, cursor: "pointer",
                    background: value === o ? "color-mix(in srgb, var(--color-accent) 15%, transparent)" : "transparent",
                    color: value === o ? "var(--color-accent)" : "var(--color-text)",
                    fontWeight: value === o ? 600 : 400,
                    transition: "background 0.2s"
                  }}
                  onMouseEnter={(e) => { if (value !== o) e.currentTarget.style.background = "color-mix(in srgb, var(--color-text) 5%, transparent)"; }}
                  onMouseLeave={(e) => { if (value !== o) e.currentTarget.style.background = "transparent"; }}
                >
                  {o}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function AuditoriaClient({ linhas }: { linhas: Auditoria[] }) {
  const [pessoa, setPessoa] = useState("todas");
  const [ator, setAtor] = useState("todos");

  const pessoas = useMemo(() => [...new Set(linhas.map((h) => h.pessoa))], [linhas]);
  const atores = useMemo(() => [...new Set(linhas.map((h) => h.ator))], [linhas]);

  const filtradas = linhas.filter(
    (h) => (pessoa === "todas" || h.pessoa === pessoa) && (ator === "todos" || h.ator === ator)
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32, width: "100%" }}>
      {/* HEADER */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "color-mix(in srgb, var(--color-text) 40%, transparent)" }}>
          Transversal
        </span>
        <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1 }}>
          Log de auditoria
        </h1>
      </div>

      {/* FILTROS */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <FilterSelect 
          value={pessoa} onChange={setPessoa} options={pessoas} 
          defaultLabel="Todas as pessoas" placeholder="Buscar pessoa..." 
        />
        <FilterSelect 
          value={ator} onChange={setAtor} options={atores} 
          defaultLabel="Todos os atores" placeholder="Buscar ator..." 
        />
        
        <div style={{ marginLeft: "auto", fontSize: 13, color: "color-mix(in srgb, var(--color-text) 50%, transparent)", fontWeight: 500 }}>
          Mostrando {filtradas.length} registro{filtradas.length === 1 ? "" : "s"}
        </div>
      </div>

      {/* LISTA */}
      <div
        style={{
          display: "flex", flexDirection: "column",
          background: "color-mix(in srgb, var(--color-surface) 30%, transparent)",
          border: "1px solid color-mix(in srgb, var(--color-text) 5%, transparent)",
          borderRadius: 16, overflow: "hidden",
          backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
        }}
      >
        {filtradas.length === 0 && (
          <div style={{ padding: "32px 0", textAlign: "center", color: "color-mix(in srgb, var(--color-text) 40%, transparent)", fontSize: 13 }}>
            Nenhum registro com esse filtro
          </div>
        )}
        {filtradas.map((h, i) => {
          const isLast = i === filtradas.length - 1;
          return (
            <div
              key={h.id}
              style={{
                display: "grid", gridTemplateColumns: "180px 180px 1fr 140px", gap: 16, alignItems: "center",
                padding: "8px 16px",
                borderBottom: isLast ? "none" : "1px solid color-mix(in srgb, var(--color-text) 5%, transparent)",
                transition: "background 0.2s",
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "color-mix(in srgb, var(--color-text) 3%, transparent)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              {/* Coluna 1: Pessoa */}
              <span style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {h.pessoa || "—"}
              </span>
              
              {/* Coluna 2: Tabela.Campo */}
              <div style={{ display: "flex", alignItems: "center" }}>
                <span style={{ 
                  fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700,
                  color: "var(--color-accent)",
                  background: "color-mix(in srgb, var(--color-accent) 15%, transparent)",
                  padding: "4px 8px", borderRadius: 6,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%"
                }}>
                  {h.tabela}.{h.campo}
                </span>
              </div>
              
              {/* Coluna 3: Mudança (Antes -> Depois) */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden" }}>
                {h.antes && (
                  <span style={{ 
                    fontSize: 12, color: "var(--color-text)", opacity: 0.6,
                    textDecoration: "line-through", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                  }}>
                    {h.antes}
                  </span>
                )}
                
                {h.antes && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", opacity: 0.3 }}>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                    <polyline points="12 5 19 12 12 19"></polyline>
                  </svg>
                )}
                
                <span style={{ fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {h.depois}
                </span>
              </div>

              {/* Coluna 4: Data e Ator */}
              <div style={{ 
                display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 0
              }}>
                <span style={{ fontSize: 11, color: "var(--color-text)", opacity: 0.75, fontWeight: 500, whiteSpace: "nowrap" }}>
                  {quandoBR(h.quando)}
                </span>
                <span style={{ fontSize: 10, fontFamily: "var(--mono)", color: "var(--color-text)", opacity: 0.55, whiteSpace: "nowrap", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {h.ator}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
