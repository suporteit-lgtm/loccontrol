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
const LIMITE_CARDS = 3;

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
        eyebrow="Visão RH"
        titulo="Fila do RH"
        sub={`Tudo o que depende do RH agora · pré-admissões, offboarding, documentos e afastamentos · ${unidadeAtual}`}
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
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "var(--space-3)",
          alignItems: "start",
        }}
      >
        {colsVisiveis.map((col) => {
          const expandido = expandidas[col.label] ?? false;
          const cardsVisiveis = expandido ? col.cards : col.cards.slice(0, LIMITE_CARDS);
          const restantes = col.cards.length - cardsVisiveis.length;
          return (
          <div key={col.label} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <h6 style={{ margin: 0, display: "flex", alignItems: "center", gap: 7, color: col.cor }}>
              <span style={{ width: 8, height: 8, flex: "none", borderRadius: "50%", background: col.cor }} />
              {col.label}
              <span style={{ fontFamily: "var(--mono)", marginLeft: "auto" }}>{col.cards.length}</span>
            </h6>
            {col.cards.length === 0 && (
              <div
                className="text-muted"
                style={{ border: "1px dashed var(--color-divider)", padding: 16, fontSize: 12, borderRadius: 10 }}
              >
                Nada aqui — bom sinal
              </div>
            )}
            {cardsVisiveis.map((k) => {
              const sl = sla(k.slaAlvo, now);
              return (
                <div key={k.key} className="card elev-sm" style={{ borderLeft: `3px solid ${k.urgCor}`, gap: 6, minHeight: 148 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontFamily: "var(--font-body)", fontWeight: 700, fontSize: 15 }}>{k.nome}</span>
                    {k.id && (
                      <span style={{ fontFamily: "var(--mono)", fontSize: 11 }} className="text-muted">
                        {k.id}
                      </span>
                    )}
                  </div>
                  <div
                    className="text-muted"
                    title={k.sub}
                    style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 2 }}
                  >
                    <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{k.sub}</div>
                    {k.unidade && <div>{k.unidade}</div>}
                    {k.solicitante && <div>Solicitado por {k.solicitante}</div>}
                  </div>
                  {sl && (
                    <div style={{ fontFamily: "var(--mono)", fontSize: 13, color: sl.cor, fontWeight: sl.peso }}>
                      faltam {sl.txt}
                    </div>
                  )}
                  {k.pendencias && <Chips itens={k.pendencias} cor={k.urgCor} />}
                  <div style={{ display: "flex", gap: 8, marginTop: "auto", flexWrap: "wrap" }}>
                    <Link href={k.href} className="btn btn-secondary" style={{ fontSize: 13, padding: "4px 12px" }}>
                      {k.acao}
                    </Link>
                    {k.ativarColabId && (
                      <>
                        <button
                          className="btn btn-ghost"
                          style={{ fontSize: 13, padding: "4px 8px", color: "var(--danger-forte)" }}
                          disabled={pending}
                          onClick={() => setNaoAtivando(k)}
                        >
                          Não ativar
                        </button>
                        <button
                          className="btn btn-primary"
                          style={{ fontSize: 13, padding: "4px 12px" }}
                          disabled={pending}
                          onClick={() => ativar(k.ativarColabId!)}
                        >
                          {pending ? "Ativando..." : "Ativar na empresa"}
                        </button>
                      </>
                    )}
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
            {expandido && col.cards.length > LIMITE_CARDS && (
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
