"use client";

import { useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader, StatusPill } from "@/components/ui";
import { SelectCustom } from "@/components/SelectCustom";
import { useToast } from "@/components/Toast";
import { reabrirChamado } from "@/app/actions/chamados";
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
  const [reabrindo, setReabrindo] = useState<LinhaHistorico | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

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
        <SelectCustom
          className="input"
          style={{ maxWidth: 220, fontSize: 13, background: "var(--color-bg)", border: "1px solid var(--color-divider)", borderRadius: 12, padding: "8px 12px" }}
          value={fTipo || "Todos os tipos"}
          options={["Todos os tipos", ...tipos]}
          onChange={(v) => setFTipo(v === "Todos os tipos" ? "" : v)}
        />
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
                <th></th>
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
                  <td className="nowrap">
                    <button
                      className="btn btn-secondary"
                      style={{ padding: "4px 10px", fontSize: 12 }}
                      onClick={() => setReabrindo(l)}
                    >
                      Reabrir
                    </button>
                  </td>
                </tr>
              ))}
              {filtradas.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-muted" style={{ textAlign: "center", padding: 24, fontSize: 13 }}>
                    Nada com esse filtro
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {reabrindo &&
        createPortal(
          <div className="dialog-backdrop" onClick={() => !pending && setReabrindo(null)}>
            <div className="dialog" onClick={(e) => e.stopPropagation()}>
              <span className="dialog-title">Reabrir chamado {reabrindo.id}?</span>
              <div className="dialog-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <span>
                  <strong>{reabrindo.nome}</strong> · {reabrindo.tipo} volta pra fila{" "}
                  {visao === "ti" ? "da TI" : "do RH"} como em andamento.
                </span>
              </div>
              <div className="dialog-actions">
                <button className="btn btn-secondary" disabled={pending} onClick={() => setReabrindo(null)}>
                  Cancelar
                </button>
                <button
                  className="btn btn-primary"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const res = await reabrirChamado(reabrindo.id, visao);
                      toast(res.msg, res.ok ? "ok" : "erro");
                      setReabrindo(null);
                      router.refresh();
                    })
                  }
                >
                  {pending ? "Reabrindo..." : "Reabrir chamado"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
