"use client";

import { useEffect, useState } from "react";
import { avatar, pill } from "@/lib/format";
import type { FatiaStatus } from "@/lib/types";
import { ThemeToggleButton } from "./ThemeToggle";
import { Icone } from "./Icone";

/** Relógio que atualiza a cada 30s (SLA), como no protótipo. */
export function useNow(intervaloMs = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervaloMs);
    return () => clearInterval(t);
  }, [intervaloMs]);
  return now;
}

export function AvatarCircle({ nome, tamanho = 26 }: { nome: string; tamanho?: number }) {
  const av = avatar(nome);
  return (
    <span
      style={{
        width: tamanho,
        height: tamanho,
        flex: "none",
        display: "grid",
        placeItems: "center",
        borderRadius: "50%",
        background: av.bg,
        color: av.cor,
        border: `1px solid ${av.borda}`,
        fontFamily: "var(--font-body)",
        fontWeight: 700,
        fontSize: tamanho >= 32 ? 12 : 11,
      }}
    >
      {av.ini}
    </span>
  );
}

export function StatusPill({ status }: { status: string }) {
  const p = pill(status);
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 10,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        padding: "2px 10px",
        borderRadius: 999,
        border: `1px solid ${p.borda}`,
        background: p.bg,
        color: p.cor,
        whiteSpace: "nowrap",
      }}
    >
      {status}
    </span>
  );
}

export function PageHeader({
  eyebrow,
  titulo,
  sub,
  /** Coloca o `sub` do lado do título, na mesma linha, em vez de embaixo. */
  subInline,
  acoes,
  /** Botão de tema claro/escuro — só aparece se pedido (hoje: Dashboard e Dashboard TI). */
  themeToggle,
}: {
  eyebrow?: string;
  titulo: string;
  sub?: React.ReactNode;
  subInline?: boolean;
  acoes?: React.ReactNode;
  themeToggle?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <div>
        {eyebrow && (
          <h6 className="text-muted" style={{ margin: 0 }}>
            {eyebrow}
          </h6>
        )}
        {subInline ? (
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0 }}>{titulo}</h2>
            {sub && (
              <div className="text-muted" style={{ fontSize: 13 }}>
                {sub}
              </div>
            )}
          </div>
        ) : (
          <>
            <h2 style={{ margin: 0 }}>{titulo}</h2>
            {sub && (
              <div className="text-muted" style={{ fontSize: 13 }}>
                {sub}
              </div>
            )}
          </>
        )}
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        {acoes}
        {themeToggle && (
          <ThemeToggleButton style={{ borderRadius: 999, background: "color-mix(in srgb, var(--color-text) 5%, transparent)", border: "none" }} />
        )}
      </div>
    </div>
  );
}

export function DistribuicaoStatus({ dados, total }: { dados: FatiaStatus[]; total: number }) {
  return (
    <div className="card" style={{ gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
        <span className="card-title">Distribuição por status</span>
        <span className="text-muted" style={{ fontSize: 12 }}>
          {total} chamado{total === 1 ? "" : "s"} no total
        </span>
      </div>
      {total === 0 ? (
        <span className="text-muted" style={{ fontSize: 13 }}>
          Nenhum chamado registrado ainda
        </span>
      ) : (
        <>
          <div style={{ display: "flex", height: 8, borderRadius: 999, overflow: "hidden", background: "var(--color-neutral-200)" }}>
            {dados
              .filter((d) => d.n > 0)
              .map((d) => (
                <div key={d.st} title={`${d.st}: ${d.n}`} style={{ flex: d.n, background: d.cor }} />
              ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
            {dados.map((d) => (
              <span key={d.st} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                <i style={{ width: 8, height: 8, borderRadius: "50%", background: d.cor, flex: "none" }} />
                {d.st}
                <strong style={{ fontFamily: "var(--mono)" }}>{d.n}</strong>
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function StatCard({
  label,
  n,
  cor,
  onClick,
  icone,
}: {
  label: string;
  n: number;
  cor: string;
  onClick?: () => void;
  icone?: string;
}) {
  return (
    <div
      className="blueprint hover-lift"
      style={{
        padding: "calc(var(--space-4) * 1.25)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        cursor: onClick ? "pointer" : "default",
        overflow: "hidden",
        position: "relative",
      }}
      onClick={onClick}
    >
      {/* Glow suave ao fundo baseado na cor do card para dar volume */}
      <div 
        style={{
          position: "absolute",
          top: -40,
          right: -40,
          width: 100,
          height: 100,
          background: cor,
          filter: "blur(50px)",
          opacity: 0.15,
          pointerEvents: "none"
        }}
      />
      {/* filete de cor no topo: identifica o número de longe sem pesar — anima no hover do card */}
      <span
        aria-hidden
        className="stat-topline"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: `linear-gradient(90deg, ${cor}, transparent 70%)`,
          opacity: 0.9,
        }}
      />
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <span
          className="text-muted"
          style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}
        >
          {label}
        </span>
        {icone && (
          <span
            aria-hidden
            style={{
              flex: "none",
              width: 32,
              height: 32,
              display: "grid",
              placeItems: "center",
              borderRadius: 10,
              background: `color-mix(in srgb, ${cor} 14%, transparent)`,
              color: cor,
            }}
          >
            <Icone nome={icone} tamanho={17} />
          </span>
        )}
      </div>
      <span
        style={{
          fontFamily: "var(--font-heading)",
          fontWeight: 800,
          fontSize: 42,
          lineHeight: 1,
          color: cor,
          textShadow: `0 2px 14px color-mix(in srgb, ${cor} 35%, transparent)`
        }}
      >
        {n}
      </span>
      <div style={{ marginTop: "auto", paddingTop: 10, borderTop: "1px solid var(--color-divider)" }} />
    </div>
  );
}
