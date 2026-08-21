"use client";

import { useEffect, useState } from "react";
import { avatar, pill } from "@/lib/format";

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
  acoes,
}: {
  eyebrow: string;
  titulo: string;
  sub?: React.ReactNode;
  acoes?: React.ReactNode;
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
        <h6 className="text-muted" style={{ margin: 0 }}>
          {eyebrow}
        </h6>
        <h2 style={{ margin: 0 }}>{titulo}</h2>
        {sub && (
          <div className="text-muted" style={{ fontSize: 13 }}>
            {sub}
          </div>
        )}
      </div>
      {acoes}
    </div>
  );
}

export function StatCard({
  label,
  n,
  cor,
  onClick,
}: {
  label: string;
  n: number;
  cor: string;
  onClick?: () => void;
}) {
  return (
    <div
      className="blueprint hover-lift"
      style={{
        padding: "var(--space-4)",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        cursor: onClick ? "pointer" : "default",
        overflow: "hidden",
        position: "relative",
      }}
      onClick={onClick}
    >
      {/* filete de cor no topo: identifica o número de longe sem pesar */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: `linear-gradient(90deg, ${cor}, transparent 70%)`,
          opacity: 0.75,
        }}
      />
      <span
        className="text-muted"
        style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase" }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: "var(--font-heading)",
          fontWeight: 700,
          fontSize: 36,
          lineHeight: 1,
          color: cor,
        }}
      >
        {n}
      </span>
    </div>
  );
}
