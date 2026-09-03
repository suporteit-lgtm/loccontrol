"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader, useNow } from "@/components/ui";
import { SelectCustom } from "@/components/SelectCustom";
import { useToast } from "@/components/Toast";
import { sla } from "@/lib/format";
import { ativarNaEmpresa, naoAtivarNaEmpresa } from "@/app/actions/colaboradores";
import { ComoFunciona, FLUXO_ADMISSAO_RH, FLUXO_OFFBOARDING_RH } from "@/components/ComoFunciona";

export interface CardRH {
  key: string;
  nome: string;
  id: string;
  sub: string;
  slaAlvo: string | null;
  urgCor: string;
  acao: string;
  href: string;
  /** O que ainda falta informar/revisar — vira chip no card. */
  pendencias?: string[];
  /** Preenchido quando a TI já entregou a conta: habilita "Ativar na empresa". */
  ativarColabId?: string;
  /** E-mail corporativo já criado — mostrado no aviso de "Não ativar". */
  email?: string | null;
  /** Quem abriu a solicitação (RH) — mostrado no card e usado no filtro. */
  solicitante?: string | null;
  /** Base do colaborador ("Cidade · Unidade") — visível sem abrir o card. */
  unidade?: string | null;
}

/** Cards visíveis por coluna antes do "Ver mais" — cards menores cabem mais na tela. */
const LIMITE_CARDS = 4;
/** Colunas com limite próprio, diferente do padrão acima. */
const LIMITE_POR_COLUNA: Record<string, number> = { "Prontos para ativar": 5 };

export function Chips({ itens, cor }: { itens: string[]; cor: string }) {
  if (!itens.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      {itens.map((t) => (
        <span
          key={t}
          style={{
            fontSize: 10.5,
            lineHeight: 1.5,
            padding: "1px 7px",
            borderRadius: 999,
            border: `1px solid ${cor}`,
            color: cor,
            whiteSpace: "nowrap",
          }}
        >
          {t}
        </span>
      ))}
    </div>
  );
}

export function FilaRHClient({
  unidadeAtual,
  cols,
}: {
  unidadeAtual: string;
  cols: { label: string; cor: string; cards: CardRH[] }[];
}) {
  const now = useNow();
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [naoAtivando, setNaoAtivando] = useState<CardRH | null>(null);
  // colunas com mais de LIMITE_CARDS ficam recolhidas até clicar em "Ver mais"
  const [expandidas, setExpandidas] = useState<Record<string, boolean>>({});
  const TODOS_SOL = "Todos os solicitantes";
  const [filtroSol, setFiltroSol] = useState(TODOS_SOL);

  const opcoesSol = useMemo(() => {
    const nomes = [
      ...new Set(cols.flatMap((c) => c.cards.map((k) => k.solicitante).filter(Boolean) as string[])),
    ].sort((a, b) => a.localeCompare(b));
    return [TODOS_SOL, ...nomes];
  }, [cols]);

  // sem solicitante (afastamentos, registros antigos) o card só aparece em "Todos"
  const colsVisiveis =
    filtroSol === TODOS_SOL
      ? cols
      : cols.map((c) => ({ ...c, cards: c.cards.filter((k) => k.solicitante === filtroSol) }));

  // trava o scroll da página com o dialog aberto (mesmo padrão da fila da TI)
  useEffect(() => {
    if (!naoAtivando) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [naoAtivando]);

  const ativar = (colabId: string) =>
    start(async () => {
      const res = await ativarNaEmpresa(colabId);
      toast(res.msg);
      router.refresh();
    });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <PageHeader
        titulo="Fila do RH"
        sub={`Tudo o que depende do RH agora · pré-admissões, offboarding, documentos e afastamentos · ${unidadeAtual}`}
        subInline
        acoes={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <SelectCustom
              className="input"
              // largura fixa: a classe .input estica para 100% e jogava os
              // botões do cabeçalho para uma segunda linha
              style={{ fontSize: 13, padding: "6px 12px", minHeight: 36, width: 230, borderRadius: 8 }}
              value={filtroSol}
              options={opcoesSol}
              onChange={setFiltroSol}
            />
            <ComoFunciona
              titulo="Como funciona a admissão e o desligamento"
              passos={[...FLUXO_ADMISSAO_RH, ...FLUXO_OFFBOARDING_RH]}
            />
            <Link href="/fila-rh/historico" className="btn btn-secondary">
              Histórico
            </Link>
          </div>
        }
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "var(--space-4)",
          flex: 1
        }}
      >
        {colsVisiveis.map((col) => {
          const limite = LIMITE_POR_COLUNA[col.label] ?? LIMITE_CARDS;
          const expandido = expandidas[col.label] ?? false;
          const cardsVisiveis = expandido ? col.cards : col.cards.slice(0, limite);
          const restantes = col.cards.length - cardsVisiveis.length;
          return (
          <div
            key={col.label}
            style={{
              display: "flex", flexDirection: "column", gap: 8,
              background: "color-mix(in srgb, var(--color-surface) 60%, transparent)",
              padding: "16px",
              borderRadius: "16px",
              border: "1px solid color-mix(in srgb, var(--color-divider) 50%, transparent)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <h6 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8, color: col.cor, fontSize: 12, letterSpacing: "0.08em" }}>
                <span style={{ width: 8, height: 8, flex: "none", borderRadius: "50%", background: col.cor, boxShadow: `0 0 8px ${col.cor}` }} />
                {col.label}
              </h6>
              <span style={{ 
                fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700,
                background: "var(--color-bg)", padding: "2px 8px", borderRadius: "999px",
                color: "var(--color-text)", border: "1px solid var(--color-divider)"
              }}>
                {col.cards.length}
              </span>
            </div>

            {col.cards.length === 0 && (
              <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center" }}>
                <div
                  className="text-muted"
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                    border: "1px dashed var(--color-divider)", padding: "24px 20px", maxWidth: 200,
                    fontSize: 12.5, borderRadius: 12, background: "color-mix(in srgb, var(--color-bg) 50%, transparent)"
                  }}
                >
                  <span style={{ fontSize: 20 }}>☕</span> Nada aqui — bom sinal
                </div>
              </div>
            )}
            
            {cardsVisiveis.map((k) => {
              const sl = sla(k.slaAlvo, now);
              return (
                <div key={k.key} className="card hover-lift" style={{
                  borderTop: `3px solid ${k.urgCor}`,
                  gap: 6,
                  padding: "10px",
                  minHeight: 138,
                  background: "var(--color-surface)",
                  boxShadow: "var(--shadow-sm)",
                  position: "relative",
                  overflow: "hidden"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                    <span style={{
                      fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 13.5, lineHeight: 1.3,
                      flex: 1, wordBreak: "break-word"
                    }}>
                      {k.nome}
                    </span>
                    {k.id && (
                      <span style={{
                        fontFamily: "var(--mono)", fontSize: 10.5, background: "var(--color-bg)",
                        padding: "3px 7px", borderRadius: 6, border: "1px solid var(--color-divider)",
                        flex: "none", whiteSpace: "nowrap"
                      }} className="text-muted">
                        {k.id}
                      </span>
                    )}
                  </div>

                  <div
                    className="text-muted"
                    title={k.sub}
                    style={{ fontSize: 11.5, lineHeight: 1.4, display: "flex", flexDirection: "column", gap: 3 }}
                  >
                    <div>{k.sub}</div>
                    {k.unidade && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ opacity: 0.7 }}>📍</span> {k.unidade}
                      </div>
                    )}
                    {k.solicitante && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ opacity: 0.7 }}>👤</span> Solicitado por {k.solicitante}
                      </div>
                    )}
                  </div>

                  {k.pendencias && <Chips itens={k.pendencias} cor={k.urgCor} />}

                  <div style={{
                    display: "flex", gap: 8, marginTop: "auto", flexWrap: "wrap", alignItems: "center",
                    paddingTop: 8, borderTop: "1px solid var(--color-divider)",
                    justifyContent: sl ? "space-between" : "flex-end"
                  }}>
                    {sl && (
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        fontFamily: "var(--mono)", fontSize: 10.5,
                        color: sl.cor, fontWeight: sl.peso,
                        background: `color-mix(in srgb, ${sl.cor} 10%, transparent)`,
                        padding: "3px 9px", borderRadius: 999,
                        border: `1px solid color-mix(in srgb, ${sl.cor} 30%, transparent)`
                      }}>
                        ⏳ SLA: {sl.txt}
                      </span>
                    )}
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <Link href={k.href} className="btn btn-secondary" style={{ fontSize: 12, padding: "3px 12px" }}>
                        {k.acao}
                      </Link>
                      {k.ativarColabId && (
                        <>
                          <button
                            className="btn btn-ghost"
                            style={{ fontSize: 12, padding: "3px 7px", color: "var(--danger-forte)" }}
                            disabled={pending}
                            onClick={() => setNaoAtivando(k)}
                          >
                            Não ativar
                          </button>
                          <button
                            className="btn btn-primary"
                            style={{ fontSize: 12, padding: "3px 12px" }}
                            disabled={pending}
                            onClick={() => ativar(k.ativarColabId!)}
                          >
                            {pending ? "Ativando..." : "Ativar"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {restantes > 0 && (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: 12.5, alignSelf: "center" }}
                onClick={() => setExpandidas((e) => ({ ...e, [col.label]: true }))}
              >
                Ver mais {restantes}
              </button>
            )}
            {expandido && col.cards.length > limite && (
              <button
                type="button"
                className="btn btn-ghost"
                style={{ fontSize: 12.5, alignSelf: "center" }}
                onClick={() => setExpandidas((e) => ({ ...e, [col.label]: false }))}
              >
                Ver menos
              </button>
            )}
          </div>
          );
        })}
      </div>

      {naoAtivando &&
        createPortal(
          <div className="dialog-backdrop" onClick={() => !pending && setNaoAtivando(null)}>
            <div className="dialog" onClick={(e) => e.stopPropagation()}>
              <span className="dialog-title">Não ativar {naoAtivando.nome}?</span>
              <div className="dialog-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <span>
                  Para quando a pessoa <strong>desistiu da vaga</strong> ou a admissão caiu: o chamado de admissão é
                  cancelado{naoAtivando.email ? (
                    <>
                      {" "}e a conta <strong>{naoAtivando.email}</strong> é <strong>excluída do Workspace</strong>
                    </>
                  ) : null}
                  . A ficha continua em Colaboradores como registro. <strong>Não tem desfazer.</strong>
                </span>
              </div>
              <div className="dialog-actions">
                <button className="btn btn-secondary" disabled={pending} onClick={() => setNaoAtivando(null)}>
                  Cancelar
                </button>
                <button
                  className="btn btn-primary"
                  style={{ background: "var(--danger-forte)", borderColor: "var(--danger-forte)" }}
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const res = await naoAtivarNaEmpresa(naoAtivando.ativarColabId!);
                      toast(res.msg, res.ok ? "ok" : "erro");
                      setNaoAtivando(null);
                      router.refresh();
                    })
                  }
                >
                  {pending ? "Cancelando..." : "Não ativar e excluir conta"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
