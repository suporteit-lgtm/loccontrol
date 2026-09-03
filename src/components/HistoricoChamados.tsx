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
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", background: "color-mix(in srgb, var(--color-surface) 60%, transparent)", padding: "16px", borderRadius: "16px", border: "1px solid color-mix(in srgb, var(--color-divider) 50%, transparent)" }}>
        <input
          className="input"
          style={{ maxWidth: 320, background: "var(--color-bg)", border: "1px solid var(--color-divider)", borderRadius: 12, padding: "8px 12px" }}
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
        <span style={{ 
          fontFamily: "var(--mono)", fontSize: 12, fontWeight: 600,
          background: "var(--color-bg)", padding: "4px 12px", borderRadius: "999px",
          color: "var(--color-text)", border: "1px solid var(--color-divider)",
          marginLeft: "auto"
        }}>
          {filtradas.length} de {linhas.length} registro(s)
        </span>
      </div>

      {linhas.length === 0 ? (
        <div 
          className="card text-muted" 
          style={{ 
            alignItems: "center", justifyContent: "center", padding: "48px 24px",
            background: "color-mix(in srgb, var(--color-surface) 60%, transparent)",
            borderRadius: 16, border: "1px dashed var(--color-divider)"
          }}
        >
          <span style={{ fontSize: 24, marginBottom: 12 }}>✨</span>
          <span style={{ fontSize: 14 }}>
            Ainda não há chamados concluídos — os próximos encerramentos aparecem aqui.
          </span>
        </div>
      ) : (
        <div
          style={{
            overflowX: "auto",
            border: "1px solid color-mix(in srgb, var(--color-divider) 50%, transparent)",
            borderRadius: 16,
            background: "color-mix(in srgb, var(--color-surface) 60%, transparent)",
            boxShadow: "var(--shadow-sm)"
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
            <tbody style={{ background: "transparent" }}>
              {filtradas.map((l) => (
                <tr key={l.id} style={{ height: 48 }}>
                  <td className="nowrap" style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
                    <span style={{ background: "var(--color-bg)", padding: "4px 8px", borderRadius: 6, border: "1px solid var(--color-divider)" }}>
                      {l.id}
                    </span>
                  </td>
                  <td className="nowrap">
                    <StatusPill status={l.tipo} />
                  </td>
                  <td style={{ fontSize: 13.5, fontWeight: 700 }}>
                    {l.href ? (
                      <Link href={l.href} style={{ color: "var(--color-text)", textDecoration: "none" }}>
                        {l.nome}
                      </Link>
                    ) : (
                      l.nome
                    )}
                  </td>
                  <td className="text-muted" style={{ fontSize: 12.5, lineHeight: 1.4 }}>
                    {l.detalhe || "—"}
                  </td>
                  <td className="nowrap" style={{ fontSize: 12.5, fontWeight: 700, color: COR_RESULTADO[l.resultado] ?? "inherit" }}>
                    <span style={{ 
                      background: `color-mix(in srgb, ${COR_RESULTADO[l.resultado] ?? "var(--color-text)"} 10%, transparent)`,
                      padding: "4px 10px", borderRadius: 999,
                      border: `1px solid color-mix(in srgb, ${COR_RESULTADO[l.resultado] ?? "var(--color-text)"} 30%, transparent)`
                    }}>
                      {ROTULO[l.resultado] ?? l.resultado}
                    </span>
                  </td>
                  <td style={{ fontSize: 12.5, fontWeight: 500 }}>{l.concluidoPor || "—"}</td>
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
                  <td colSpan={9} className="text-muted" style={{ textAlign: "center", padding: "48px 24px", fontSize: 13 }}>
                    <div style={{ fontSize: 24, marginBottom: 12 }}>🔍</div>
                    Nenhum registro encontrado com esse filtro
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
