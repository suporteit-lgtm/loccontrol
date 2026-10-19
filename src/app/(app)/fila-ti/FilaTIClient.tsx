"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader, useNow } from "@/components/ui";
import { ComoFunciona, FLUXO_ADMISSAO_TI } from "@/components/ComoFunciona";
import { SelectCustom } from "@/components/SelectCustom";
import { useToast } from "@/components/Toast";
import { sla } from "@/lib/format";
import {
  silenciarChamado,
  reativarChamado,
  reagendarChamado,
  executarSolicitacaoUnidade,
  executarSolicitacaoGrupo,
  negarSolicitacao,
  excluirChamado,
  atribuirAnalista,
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
  /** Analista responsável pelo chamado — null = fila geral. */
  analista?: string | null;
  /** Base do colaborador ("Cidade · Unidade") — visível sem abrir o card. */
  unidade?: string | null;
  gTipo?: "criacao" | "exclusao";
  /** Conta de admissão já criada e ainda não ativada — excluir o chamado
   *  exclui essa conta do Workspace junto (mostrado no aviso). */
  email?: string | null;
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

const SEM_RESP = "Sem responsável (fila geral)";
/** Cards visíveis por coluna antes do "Ver mais" — cards menores cabem mais na tela. */
const LIMITE_CARDS = 3;

export function FilaTIClient({
  cards,
  admin,
  analistas,
  usuarioNome,
}: {
  cards: CardTI[];
  admin: boolean;
  /** Time de TI (papéis com "T.I") — opções da troca de responsável e do filtro. */
  analistas: string[];
  usuarioNome: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const now = useNow();
  const [pending, start] = useTransition();
  const [excluindo, setExcluindo] = useState<CardTI | null>(null);
  const [trocando, setTrocando] = useState<CardTI | null>(null);
  const [novoResp, setNovoResp] = useState("");
  // colunas com mais de LIMITE_CARDS ficam recolhidas até clicar em "Ver mais"
  const [expandidas, setExpandidas] = useState<Record<string, boolean>>({});
  // drag and drop entre colunas — só "Pré-concluídos" tem estado manual por
  // trás (silenciado); as outras três são calculadas pelo prazo do SLA.
  // Arraste é feito na mão via Pointer Events (não o HTML5 drag nativo) pra
  // controlar a animação: o card fantasma segue o cursor com leve rotação.
  const [arrastando, setArrastando] = useState<CardTI | null>(null);
  const [colAlvo, setColAlvo] = useState<string | null>(null);
  const [fantasma, setFantasma] = useState<{ k: CardTI; x: number; y: number; w: number; h: number; tilt: number } | null>(
    null
  );
  // a fila abre já filtrada em "meus chamados" — cada um vê o seu por padrão
  const [filtroResp, setFiltroResp] = useState(analistas.includes(usuarioNome) ? usuarioNome : SEM_RESP);

  // TODO o time de TI cadastrado no sistema, não só quem tem card na fila —
  // filtrar por alguém sem chamado mostra a fila vazia, o que também informa
  const opcoesResp = useMemo(() => [...analistas, SEM_RESP], [analistas]);

  // "Sem responsável" também cobre os pedidos de unidade/grupo (fila geral)
  const visiveis =
    filtroResp === SEM_RESP ? cards.filter((c) => !c.analista) : cards.filter((c) => c.analista === filtroResp);

  // trava o scroll da página com o dialog aberto — sem isso o fixed centraliza
  // no viewport todo (inclusive o que já rolou pra fora da tela)
  const dialogAberto = !!excluindo || !!trocando;
  useEffect(() => {
    if (!dialogAberto) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [dialogAberto]);

  // cursor de "segurando" e sem seleção de texto enquanto arrasta um card
  useEffect(() => {
    if (!arrastando) return;
    const prevCursor = document.body.style.cursor;
    const prevSelect = document.body.style.userSelect;
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
    return () => {
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevSelect;
    };
  }, [!!arrastando]);

  const acao = (fn: () => Promise<{ ok: boolean; msg: string }>, undoId?: string) =>
    start(async () => {
      const res = await fn();
      if (undoId && res.ok) {
        toast(
          res.msg,
          () =>
            start(async () => {
              await reativarChamado(undoId);
              router.refresh();
            }),
          "ok"
        );
      } else {
        toast(res.msg, res.ok ? "ok" : "erro");
      }
      router.refresh();
    });

  // prazo que o drag grava pra cada coluna — não mexe na admissão real da
  // pessoa (fica em colaboradores.admissao), só no relógio interno do
  // chamado, o mesmo que dispara os e-mails de alerta de SLA
  const slaParaColuna = (colKey: (typeof COLS)[number]["key"]): string | null => {
    const agora = Date.now();
    if (colKey === "hoje") return new Date(agora + 8 * 3600e3).toISOString();
    if (colKey === "h48") return new Date(agora + 36 * 3600e3).toISOString();
    return null; // "aguardando" — sem prazo ativo
  };

  const soltarEm = (k: CardTI, colKey: (typeof COLS)[number]["key"]) => {
    if (colunaDe(k, now) === colKey) return; // já está aí

    if (colKey === "pre") {
      acao(() => silenciarChamado(k.id), k.id);
      return;
    }

    const slaAnterior = k.slaAlvo;
    const silenciadoAntes = k.silenciado;
    start(async () => {
      const res = await reagendarChamado(k.id, slaParaColuna(colKey), false);
      if (res.ok) {
        toast(
          res.msg,
          () =>
            start(async () => {
              await reagendarChamado(k.id, slaAnterior, silenciadoAntes);
              router.refresh();
            }),
          "ok"
        );
      } else {
        toast(res.msg, "erro");
      }
      router.refresh();
    });
  };

  // pega o card no pointerdown e, só depois de um pequeno arrasto (pra não
  // roubar clique de botão/link), liga o fantasma que segue o cursor
  const iniciarArraste = (e: React.PointerEvent<HTMLDivElement>, k: CardTI) => {
    if (k.kind !== "colab" || e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button, a")) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    const startX = e.clientX;
    const startY = e.clientY;
    let iniciou = false;

    const mover = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!iniciou) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return; // ainda dentro do limiar de clique
        iniciou = true;
        setArrastando(k);
      }
      const alvo = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>("[data-col-key]");
      setColAlvo(alvo?.dataset.colKey ?? null);
      setFantasma({
        k,
        x: ev.clientX - offsetX,
        y: ev.clientY - offsetY,
        w: rect.width,
        h: rect.height,
        tilt: Math.max(-8, Math.min(8, dx / 10)),
      });
    };

    const soltar = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
      window.removeEventListener("pointercancel", soltar);
      if (iniciou) {
        const alvo = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>("[data-col-key]");
        const colKey = alvo?.dataset.colKey as (typeof COLS)[number]["key"] | undefined;
        setFantasma(null);
        setArrastando(null);
        setColAlvo(null);
        if (colKey) soltarEm(k, colKey);
      }
    };

    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
    window.addEventListener("pointercancel", soltar);
  };

  const corFantasma = fantasma
    ? COLS.find((c) => c.key === colunaDe(fantasma.k, now))?.cor ?? "var(--color-accent-300)"
    : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", width: "100%", minHeight: "100%" }}>
      <PageHeader
        eyebrow="Visão TI"
        titulo="Fila da TI"
        acoes={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <SelectCustom
              className="input"
              // largura fixa: a classe .input estica para 100% e jogava os
              // botões do cabeçalho para uma segunda linha
              style={{ fontSize: 13, padding: "6px 12px", minHeight: 36, width: 230, borderRadius: 8 }}
              value={filtroResp}
              options={opcoesResp}
              onChange={setFiltroResp}
            />
            <ComoFunciona titulo="Como funciona o chamado de admissão" passos={FLUXO_ADMISSAO_TI} />
            <Link href="/fila-ti/historico" className="btn btn-secondary">
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
          alignItems: "start",
          flex: 1
        }}
      >
        {COLS.map((col) => {
          const doGrupo = visiveis.filter((c) => colunaDe(c, now) === col.key);
          const expandido = expandidas[col.key] ?? false;
          const doGrupoVisivel = expandido ? doGrupo : doGrupo.slice(0, LIMITE_CARDS);
          const restantes = doGrupo.length - doGrupoVisivel.length;
          return (
            <div
              key={col.key}
              data-col-key={col.key}
              style={{
                display: "flex", flexDirection: "column", gap: 8,
                background:
                  colAlvo === col.key
                    ? `color-mix(in srgb, ${col.cor} 8%, var(--color-surface) 60%)`
                    : "color-mix(in srgb, var(--color-surface) 60%, transparent)",
                padding: "16px",
                borderRadius: "16px",
                border:
                  colAlvo === col.key
                    ? `1px dashed ${col.cor}`
                    : "1px solid color-mix(in srgb, var(--color-divider) 50%, transparent)",
                transition: "border-color 0.15s, background 0.15s",
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
                  {doGrupo.length}
                </span>
              </div>
              
              {doGrupo.length === 0 && (
                <div
                  className="text-muted"
                  style={{ 
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    border: "1px dashed var(--color-divider)", padding: "32px 16px", 
                    fontSize: 13, borderRadius: 12, background: "color-mix(in srgb, var(--color-bg) 50%, transparent)"
                  }}
                >
                  <span style={{ fontSize: 16 }}>✨</span> Nada aqui — bom sinal
                </div>
              )}
              {doGrupoVisivel.map((k) => {
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
                  <div
                    key={k.id}
                    className="card hover-lift"
                    onPointerDown={(e) => iniciarArraste(e, k)}
                    style={{
                      borderTop: `3px solid ${urg}`,
                      gap: 8,
                      padding: "12px",
                      background: "var(--color-surface)",
                      boxShadow: "var(--shadow-sm)",
                      position: "relative",
                      overflow: "hidden",
                      cursor: k.kind === "colab" ? "grab" : undefined,
                      touchAction: k.kind === "colab" ? "none" : undefined,
                      opacity: arrastando?.id === k.id ? 0.35 : 1,
                      transform: arrastando?.id === k.id ? "scale(0.96)" : "scale(1)",
                    }}
                  >
                    {/* Linha superior: Título e CH */}
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                      <span style={{
                        fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 13.5, lineHeight: 1.3,
                        flex: 1, wordBreak: "break-word"
                      }}>
                        {k.nome}
                      </span>
                      <span style={{
                        fontFamily: "var(--mono)", fontSize: 10.5, background: "var(--color-bg)",
                        padding: "3px 7px", borderRadius: 6, border: "1px solid var(--color-divider)",
                        flex: "none", whiteSpace: "nowrap"
                      }} className="text-muted">
                        {k.id}
                      </span>
                    </div>

                    {/* Subtítulo: Tipo, Cargo, Data */}
                    <div
                      className="text-muted"
                      title={`${k.tipo} · ${k.sub}`}
                      style={{ fontSize: 11.5, lineHeight: 1.4, display: "flex", flexDirection: "column", gap: 3 }}
                    >
                      <div><strong>{k.tipo}</strong> · {k.sub}</div>
                      {k.kind === "colab" && k.unidade && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ opacity: 0.7 }}>📍</span> {k.unidade}
                        </div>
                      )}
                      {k.kind === "colab" && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ opacity: 0.7 }}>👤</span> Responsável: {k.analista ?? "fila geral"}
                        </div>
                      )}
                      {k.kind === "colab" && k.data && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ opacity: 0.7 }}>📅</span> Previsão: {k.data}
                        </div>
                      )}
                      {k.kind === "unid" && (
                        <div>{admin ? "Aguardando sua aprovação" : "Aguardando um admin"}</div>
                      )}
                    </div>
                    
                    {/* SLA Badge */}
                    {sl && col.key !== "pre" && (
                      <div style={{ marginTop: 1 }}>
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
                      </div>
                    )}

                    {/* Alertas */}
                    {k.silenciado && (
                      <div className="text-muted" style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
                        <span>🔕</span> Alertas silenciados
                      </div>
                    )}

                    {/* Botões (Footer) */}
                    <div style={{ display: "flex", gap: 6, marginTop: "auto", flexWrap: "wrap", paddingTop: 10, borderTop: "1px solid var(--color-divider)", justifyContent: "flex-end" }}>
                      {k.kind === "colab" && (
                        <button
                          className="btn btn-ghost"
                          disabled={pending}
                          style={{ fontSize: 12, padding: "3px 7px" }}
                          onClick={() => {
                            setNovoResp(analistas.find((a) => a !== k.analista) ?? analistas[0] ?? "");
                            setTrocando(k);
                          }}
                        >
                          Trocar responsável
                        </button>
                      )}
                      {k.kind === "colab" && !k.silenciado && col.key !== "aguardando" && (
                        <button
                          className="btn btn-ghost"
                          disabled={pending}
                          style={{ fontSize: 12, padding: "3px 7px" }}
                          onClick={() => acao(() => silenciarChamado(k.id), k.id)}
                        >
                          Pré-concluir
                        </button>
                      )}
                      {k.silenciado && (
                        <button
                          className="btn btn-ghost"
                          disabled={pending}
                          style={{ fontSize: 12, padding: "3px 7px" }}
                          onClick={() => acao(() => reativarChamado(k.id))}
                        >
                          Reativar alertas
                        </button>
                      )}
                      {podeNegar && (
                        <button
                          className="btn btn-secondary"
                          disabled={pending}
                          style={{ fontSize: 12, padding: "3px 10px", color: "var(--danger-forte)", borderColor: "var(--danger)" }}
                          onClick={() => acao(() => negarSolicitacao(k.id))}
                        >
                          Negar
                        </button>
                      )}
                      {k.kind === "colab" && (
                        <button
                          className="btn btn-ghost"
                          disabled={pending}
                          style={{ fontSize: 12, padding: "3px 7px", color: "var(--danger-forte)" }}
                          onClick={() => setExcluindo(k)}
                        >
                          Excluir
                        </button>
                      )}
                      {k.kind === "colab" && (
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: 12, padding: "3px 12px" }}
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
                          style={{ fontSize: 12, padding: "3px 12px" }}
                          onClick={() =>
                            acao(() =>
                              k.kind === "grupo" ? executarSolicitacaoGrupo(k.id) : executarSolicitacaoUnidade(k.id)
                            )
                          }
                        >
                          Executar e concluir
                        </button>
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
                  onClick={() => setExpandidas((e) => ({ ...e, [col.key]: true }))}
                >
                  Ver mais {restantes}
                </button>
              )}
              {expandido && doGrupo.length > LIMITE_CARDS && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ fontSize: 12.5, alignSelf: "center" }}
                  onClick={() => setExpandidas((e) => ({ ...e, [col.key]: false }))}
                >
                  Ver menos
                </button>
              )}
            </div>
          );
        })}
      </div>

      {fantasma &&
        createPortal(
          <div
            className="card"
            style={{
              position: "fixed",
              left: fantasma.x,
              top: fantasma.y,
              width: fantasma.w,
              zIndex: 80,
              pointerEvents: "none",
              gap: 8,
              padding: "12px",
              background: "var(--color-surface)",
              borderTop: `3px solid ${corFantasma}`,
              boxShadow:
                "0 24px 48px -12px color-mix(in srgb, var(--color-neutral-900) 45%, transparent), var(--shadow-md)",
              transform: `rotate(${fantasma.tilt}deg) scale(1.04)`,
              transition: "none",
              cursor: "grabbing",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
              <span style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 13.5 }}>{fantasma.k.nome}</span>
              <span style={{ fontFamily: "var(--mono)", fontSize: 10.5 }} className="text-muted">
                {fantasma.k.id}
              </span>
            </div>
            <div className="text-muted" style={{ fontSize: 11.5 }}>
              {fantasma.k.tipo} · {fantasma.k.sub}
            </div>
          </div>,
          document.body
        )}

      {trocando &&
        createPortal(
          <div className="dialog-backdrop" onClick={() => !pending && setTrocando(null)}>
            <div className="dialog" onClick={(e) => e.stopPropagation()}>
              <span className="dialog-title">Trocar o responsável do {trocando.id}</span>
              <div className="dialog-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <span>
                  <strong>{trocando.nome}</strong> · {trocando.tipo} · hoje com{" "}
                  <strong>{trocando.analista ?? "a fila geral"}</strong>.
                </span>
                <div className="field">
                  <label>Novo responsável</label>
                  <SelectCustom
                    className="input"
                    value={novoResp}
                    options={analistas.filter((a) => a !== trocando.analista)}
                    onChange={setNovoResp}
                  />
                </div>
                <span className="text-muted" style={{ fontSize: 12.5 }}>
                  O chamado passa a aparecer só para essa pessoa na fila, e ela recebe a notificação.
                </span>
              </div>
              <div className="dialog-actions">
                <button className="btn btn-secondary" disabled={pending} onClick={() => setTrocando(null)}>
                  Cancelar
                </button>
                <button
                  className="btn btn-primary"
                  disabled={pending || !novoResp}
                  onClick={() =>
                    start(async () => {
                      const res = await atribuirAnalista(trocando.id, novoResp);
                      toast(res.msg, res.ok ? "ok" : "erro");
                      setTrocando(null);
                      router.refresh();
                    })
                  }
                >
                  {pending ? "Transferindo..." : "Transferir chamado"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {excluindo &&
        createPortal(
          <div className="dialog-backdrop" onClick={() => !pending && setExcluindo(null)}>
            <div className="dialog" onClick={(e) => e.stopPropagation()}>
              <span className="dialog-title">Excluir chamado {excluindo.id}?</span>
              <div className="dialog-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <span>
                  <strong>{excluindo.nome}</strong> · {excluindo.tipo} sai da fila da TI e vai pro histórico como
                  cancelado.
                  {excluindo.email ? (
                    <>
                      {" "}A conta <strong>{excluindo.email}</strong> criada para esta admissão será{" "}
                      <strong>excluída do Workspace</strong>.
                    </>
                  ) : null}{" "}
                  <strong>Não tem desfazer.</strong>
                </span>
              </div>
              <div className="dialog-actions">
                <button className="btn btn-secondary" disabled={pending} onClick={() => setExcluindo(null)}>
                  Cancelar
                </button>
                <button
                  className="btn btn-primary"
                  style={{ background: "var(--danger-forte)", borderColor: "var(--danger-forte)" }}
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const res = await excluirChamado(excluindo.id);
                      toast(res.msg, res.ok ? "ok" : "erro");
                      setExcluindo(null);
                      router.refresh();
                    })
                  }
                >
                  Excluir chamado
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
