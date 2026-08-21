"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader, useNow } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { sla } from "@/lib/format";
import {
  silenciarChamado,
  reativarChamado,
  executarSolicitacaoUnidade,
  executarSolicitacaoGrupo,
  negarSolicitacao,
} from "@/app/actions/chamados";

export interface CardTI {
  kind: "colab" | "unid" | "grupo";
  id: string;
  nome: string;
  sub: string;
  tipo: string;
  data: string;
  slaAlvo: string | null;
  silenciado: boolean;
  colabId: string | null;
  gTipo?: "criacao" | "exclusao";
  /** O que falta informar/liberar — vira chip no card. */
  pendencias?: string[];
}

const COLS = [
  { key: "hoje", label: "Vence hoje", cor: "var(--danger-forte)" },
  { key: "h48", label: "Próximas 48h", cor: "var(--warn-forte)" },
  { key: "aguardando", label: "Aguardando", cor: "var(--color-accent-700)" },
  { key: "pre", label: "Pré-concluídos", cor: "var(--ok-forte)" },
] as const;

function colunaDe(c: CardTI, now: number): (typeof COLS)[number]["key"] {
  if (c.silenciado) return "pre";
  if (!c.slaAlvo) return "aguardando";
  const restante = new Date(c.slaAlvo).getTime() - now;
  if (restante < 24 * 3600e3) return "hoje";
  if (restante < 48 * 3600e3) return "h48";
  return "aguardando";
}

export function FilaTIClient({ cards, admin }: { cards: CardTI[]; admin: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const now = useNow();
  const [pending, start] = useTransition();

  const acao = (fn: () => Promise<{ ok: boolean; msg: string }>, undoId?: string) =>
    start(async () => {
      const res = await fn();
      if (undoId && res.ok) {
        toast(res.msg, () =>
          start(async () => {
            await reativarChamado(undoId);
            router.refresh();
          })
        );
      } else {
        toast(res.msg);
      }
      router.refresh();
    });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <PageHeader
        eyebrow="Visão TI"
        titulo="Fila da TI"
        acoes={
          <Link href="/fila-ti/historico" className="btn btn-secondary">
            Histórico
          </Link>
        }
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "var(--space-3)",
          alignItems: "start",
        }}
      >
        {COLS.map((col) => {
          const doGrupo = cards.filter((c) => colunaDe(c, now) === col.key);
          return (
            <div key={col.key} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <h6 style={{ margin: 0, display: "flex", alignItems: "center", gap: 7, color: col.cor }}>
                <span style={{ width: 8, height: 8, flex: "none", borderRadius: "50%", background: col.cor }} />
                {col.label}
                <span style={{ fontFamily: "var(--mono)", marginLeft: "auto" }}>{doGrupo.length}</span>
              </h6>
              {doGrupo.length === 0 && (
                <div
                  className="text-muted"
                  style={{ border: "1px dashed var(--color-divider)", padding: 16, fontSize: 12, borderRadius: 10 }}
                >
                  Nada aqui — bom sinal
                </div>
              )}
              {doGrupo.map((k) => {
                const sl = sla(k.slaAlvo, now);
                const urg =
                  k.kind === "unid"
                    ? "var(--warn)"
                    : k.kind === "grupo"
                      ? "var(--color-accent)"
                      : col.key === "hoje"
                        ? "var(--danger)"
                        : col.key === "h48"
                          ? "var(--warn)"
                          : col.key === "pre"
                            ? "var(--ok)"
                            : "var(--color-accent-300)";
                const podeExec = k.kind === "grupo" || (k.kind === "unid" && admin);
                const podeNegar = k.kind === "unid" ? admin : k.kind === "grupo" && k.gTipo === "exclusao";
                return (
                  <div key={k.id} className="card elev-sm" style={{ borderLeft: `3px solid ${urg}`, gap: 6, minHeight: 148 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ fontFamily: "var(--font-body)", fontWeight: 700, fontSize: 15 }}>{k.nome}</span>
                      <span style={{ fontFamily: "var(--mono)", fontSize: 11 }} className="text-muted">
                        {k.id}
                      </span>
                    </div>
                    <div
                      className="text-muted"
                      title={`${k.tipo} · ${k.sub}`}
                      style={{ fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                    >
                      {k.tipo} · {k.sub}
                      {k.kind === "colab" && k.data ? ` · ${k.data}` : ""}
                      {k.kind === "unid" ? ` · ${admin ? "aguardando sua aprovação" : "aguardando um admin"}` : ""}
                    </div>
                    {sl && col.key !== "pre" && (
                      <div style={{ fontFamily: "var(--mono)", fontSize: 13, color: sl.cor, fontWeight: sl.peso }}>
                        {sl.txt}
                      </div>
                    )}
                    {k.silenciado && (
                      <div className="text-muted" style={{ fontSize: 12 }}>
                        🔕 alertas silenciados
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 8, marginTop: "auto", flexWrap: "wrap" }}>
                      {k.kind === "colab" && (
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: 13, padding: "4px 12px" }}
                          onClick={() =>
                            router.push(k.tipo === "Desligamento" ? `/offboarding/${k.colabId}` : `/chamados/${k.id}`)
                          }
                        >
                          Abrir
                        </button>
                      )}
                      {podeExec && (
                        <button
                          className="btn btn-primary"
                          disabled={pending}
                          style={{ fontSize: 13, padding: "4px 12px" }}
                          onClick={() =>
                            acao(() =>
                              k.kind === "grupo" ? executarSolicitacaoGrupo(k.id) : executarSolicitacaoUnidade(k.id)
                            )
                          }
                        >
                          Executar e concluir
                        </button>
                      )}
                      {podeNegar && (
                        <button
                          className="btn btn-secondary"
                          disabled={pending}
                          style={{ fontSize: 13, padding: "4px 12px", color: "var(--danger-forte)", borderColor: "var(--danger)" }}
                          onClick={() => acao(() => negarSolicitacao(k.id))}
                        >
                          Negar pedido
                        </button>
                      )}
                      {k.kind === "colab" && !k.silenciado && col.key !== "aguardando" && (
                        <button
                          className="btn btn-ghost"
                          disabled={pending}
                          style={{ fontSize: 13, padding: "4px 8px" }}
                          onClick={() => acao(() => silenciarChamado(k.id), k.id)}
                        >
                          Pré-concluído
                        </button>
                      )}
                      {k.silenciado && (
                        <button
                          className="btn btn-ghost"
                          disabled={pending}
                          style={{ fontSize: 13, padding: "4px 8px" }}
                          onClick={() => acao(() => reativarChamado(k.id))}
                        >
                          Reativar alertas
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
