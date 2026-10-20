"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/ui";
import { quandoBR } from "@/lib/format";
import type { Auditoria } from "@/lib/types";

export function AuditoriaClient({ linhas }: { linhas: Auditoria[] }) {
  const [pessoa, setPessoa] = useState("todas");
  const [ator, setAtor] = useState("todos");

  const pessoas = useMemo(() => [...new Set(linhas.map((h) => h.pessoa))], [linhas]);
  const atores = useMemo(() => [...new Set(linhas.map((h) => h.ator))], [linhas]);

  const filtradas = linhas.filter(
    (h) => (pessoa === "todas" || h.pessoa === pessoa) && (ator === "todos" || h.ator === ator)
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <PageHeader eyebrow="Transversal" titulo="Log de auditoria" />
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <select className="input" style={{ maxWidth: 230 }} value={pessoa} onChange={(e) => setPessoa(e.target.value)}>
          <option value="todas">Todas as pessoas</option>
          {pessoas.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select className="input" style={{ maxWidth: 200 }} value={ator} onChange={(e) => setAtor(e.target.value)}>
          <option value="todos">Todos os atores</option>
          {atores.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
      <div
        style={{
          border: "1px solid var(--color-divider)",
          background: "var(--color-surface)",
          padding: "0 var(--space-3)",
          borderRadius: 10,
        }}
      >
        {filtradas.length === 0 && (
          <div className="text-muted" style={{ fontSize: 13, padding: "12px 0" }}>
            Nenhum registro com esse filtro
          </div>
        )}
        {filtradas.map((h) => (
          <div
            key={h.id}
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 10,
              padding: "10px 0",
              borderBottom: "1px solid var(--color-divider)",
              fontSize: 13,
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontSize: 14, minWidth: 170 }}>{h.pessoa}</span>
            <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--color-accent-700)" }}>
              {h.tabela}.{h.campo}
            </span>
            <span className="text-muted" style={{ textDecoration: "line-through" }}>
              {h.antes}
            </span>
            <span>→</span>
            <span>{h.depois}</span>
            <span className="text-muted" style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 11 }}>
              {quandoBR(h.quando)} · {h.ator}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
