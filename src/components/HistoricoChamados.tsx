"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader, StatusPill } from "@/components/ui";
import { quandoBR } from "@/lib/format";

export interface LinhaHistorico {
  id: string;
  tipo: string;
  nome: string;
  detalhe: string;
  resultado: string;
  concluidoPor: string;
  abertoEm: string;
  concluidoEm: string;
  /** link para o perfil, quando o registro é de uma pessoa */
  href?: string;
}

const COR_RESULTADO: Record<string, string> = {
  concluido: "var(--ok-forte)",
  cancelado: "var(--color-neutral-600)",
  negado: "var(--danger-forte)",
};

const ROTULO: Record<string, string> = {
  concluido: "Concluído",
  cancelado: "Cancelado",
  negado: "Negado",
};

export function HistoricoChamados({
  visao,
  voltarPara,
  linhas,
}: {
  visao: "rh" | "ti";
  voltarPara: string;
  linhas: LinhaHistorico[];
}) {
  const [busca, setBusca] = useState("");
  const [fTipo, setFTipo] = useState("");

  const tipos = useMemo(() => [...new Set(linhas.map((l) => l.tipo))].sort(), [linhas]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return linhas.filter(
      (l) =>
        (!fTipo || l.tipo === fTipo) &&
        (!q || `${l.id} ${l.nome} ${l.detalhe} ${l.concluidoPor}`.toLowerCase().includes(q))
    );
  }, [linhas, busca, fTipo]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <PageHeader
        eyebrow={visao === "ti" ? "Visão TI" : "Visão RH"}
        titulo="Histórico de chamados"
        sub={`Tudo o que já passou pela fila ${visao === "ti" ? "da TI" : "do RH"} · nada é apagado`}
        acoes={
          <Link href={voltarPara} className="btn btn-secondary">
            ← Voltar à fila
          </Link>
        }
      />
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input
          className="input"
          style={{ maxWidth: 320 }}
          placeholder="Buscar por nome, chamado ou quem concluiu"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <select
          className="input"
          style={{ maxWidth: 220, fontSize: 13 }}
          value={fTipo}
          onChange={(e) => setFTipo(e.target.value)}
        >
          <option value="">Todos os tipos</option>
          {tipos.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <span className="text-muted" style={{ fontSize: 12, fontFamily: "var(--mono)", marginLeft: "auto" }}>
          {filtradas.length} de {linhas.length} registro(s)
        </span>
      </div>

      {linhas.length === 0 ? (
        <div className="card" style={{ alignItems: "center", padding: "var(--space-8)" }}>
          <span className="text-muted" style={{ fontSize: 14 }}>
            Ainda não há chamados concluídos — os próximos encerramentos aparecem aqui.
          </span>
        </div>
      ) : (
        <div
          style={{
            overflowX: "auto",
            border: "1px solid var(--color-divider)",
            borderRadius: 10,
            background: "var(--color-surface)",
          }}
        >
          <table className="table" style={{ minWidth: 760 }}>
            <thead>
              <tr>
                <th>Chamado</th>
                <th>Tipo</th>
                <th>{visao === "ti" ? "Alvo" : "Colaborador"}</th>
                <th>Detalhe</th>
                <th>Resultado</th>
                <th>Encerrado por</th>
                <th>Aberto em</th>
                <th>Encerrado em</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((l) => (
                <tr key={l.id} style={{ height: 38 }}>
                  <td className="nowrap" style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
                    {l.id}
                  </td>
                  <td className="nowrap">
                    <StatusPill status={l.tipo} />
                  </td>
                  <td style={{ fontSize: 13.5, fontWeight: 600 }}>
                    {l.href ? (
                      <Link href={l.href} style={{ color: "inherit" }}>
                        {l.nome}
                      </Link>
                    ) : (
                      l.nome
                    )}
                  </td>
                  <td className="text-muted" style={{ fontSize: 12.5 }}>
                    {l.detalhe || "—"}
                  </td>
                  <td className="nowrap" style={{ fontSize: 12.5, fontWeight: 700, color: COR_RESULTADO[l.resultado] ?? "inherit" }}>
                    {ROTULO[l.resultado] ?? l.resultado}
                  </td>
                  <td style={{ fontSize: 12.5 }}>{l.concluidoPor || "—"}</td>
                  <td className="nowrap text-muted" style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
                    {quandoBR(l.abertoEm)}
                  </td>
                  <td className="nowrap" style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
                    {quandoBR(l.concluidoEm)}
                  </td>
                </tr>
              ))}
              {filtradas.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-muted" style={{ textAlign: "center", padding: 24, fontSize: 13 }}>
                    Nada com esse filtro
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
