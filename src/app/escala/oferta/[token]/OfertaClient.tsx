"use client";

import { useState, useTransition } from "react";
import { Contagem } from "@/components/escala/AcoesDia";
import { responderOfertaPorToken, type Resultado } from "@/app/escala/actions";

export function OfertaClient({ token, expira }: { token: string; expira: string }) {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<Resultado | null>(null);

  if (res)
    return (
      <div
        role="status"
        style={{
          fontSize: 14,
          padding: "10px 14px",
          borderRadius: 8,
          background: res.ok ? "var(--ok-bg)" : "var(--danger-bg)",
          color: res.ok ? "var(--ok-forte)" : "var(--danger-forte)",
        }}
      >
        {res.msg}
      </div>
    );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Contagem ate={expira} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="btn btn-primary" disabled={pending} onClick={() => start(async () => setRes(await responderOfertaPorToken(token, true)))}>
          {pending ? "Enviando..." : "Aceitar vaga"}
        </button>
        <button className="btn btn-secondary" disabled={pending} onClick={() => start(async () => setRes(await responderOfertaPorToken(token, false)))}>
          Recusar
        </button>
      </div>
    </div>
  );
}
