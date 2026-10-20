"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { useNow } from "@/components/ui";
import { GrupoBadge } from "./GrupoBadge";
import {
  aceitarOferta,
  cancelarReserva,
  desfazerAusencia,
  entrarFila,
  naoVou,
  recusarOferta,
  reservar,
  sairFila,
  type Resultado,
} from "@/app/escala/actions";
import { dataLonga, horaSP, maiuscula, restante } from "@/lib/escala/formato";
import type { ContextoPortal, DiaPortal } from "@/lib/escala/portal";

// ── Peças reutilizadas no portal ─────────────────────────────────────────────
export function Folha({ titulo, onFechar, children }: { titulo: string; onFechar: () => void; children: React.ReactNode }) {
  return (
    <div className="dialog-backdrop folha" onClick={onFechar} role="presentation">
      <div className="dialog" role="dialog" aria-modal="true" aria-label={titulo} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div className="dialog-title" style={{ fontSize: 19 }}>{titulo}</div>
          <button className="btn btn-ghost" onClick={onFechar} aria-label="Fechar" style={{ fontSize: 18, lineHeight: 1 }}>
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Contagem({ ate }: { ate: string }) {
  const agora = useNow(15_000);
  const ms = new Date(ate).getTime() - agora;
  return (
    <span className="tag" style={{ background: "var(--warn-bg)", color: "var(--warn-forte)", fontWeight: 700 }}>
      {ms > 0 ? `expira em ${restante(ms)}` : "expirada"}
    </span>
  );
}

export function StatusTag({ tipo, children }: { tipo: "ok" | "warn" | "danger" | "neutro" | "accent"; children: React.ReactNode }) {
  const cores = {
    ok: ["var(--ok-bg)", "var(--ok-forte)"],
    warn: ["var(--warn-bg)", "var(--warn-forte)"],
    danger: ["var(--danger-bg)", "var(--danger-forte)"],
    neutro: ["var(--color-neutral-100)", "var(--color-neutral-800)"],
    accent: ["var(--color-accent-100)", "var(--color-accent-700)"],
  }[tipo];
  return (
    <span className="tag" style={{ background: cores[0], color: cores[1], fontWeight: 700 }}>
      {children}
    </span>
  );
}

/** Texto do contador de vagas: "4 vagas livres" / "Lotado · 3 na lista de espera" */
export function textoVagas(d: DiaPortal): string | null {
  const o = d.ocupacao;
  if (!o) return null;
  if (o.vagasDisponiveis > 0 && o.fila === 0)
    return `${o.vagasDisponiveis} vaga${o.vagasDisponiveis > 1 ? "s" : ""} livre${o.vagasDisponiveis > 1 ? "s" : ""}`;
  return o.fila ? `Lotado · ${o.fila} na lista de espera` : "Lotado";
}

// ── Ações de um dia (mesma regra das funções SQL, só para exibir) ───────────
export function AcoesDia({ dia, ctx, compacto = false }: { dia: DiaPortal; ctx: ContextoPortal; compacto?: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [confirmar, setConfirmar] = useState(false);

  const exec = (fn: () => Promise<Resultado>) =>
    start(async () => {
      try {
        const r = await fn();
        toast(r.msg, r.ok ? "ok" : "erro");
        setConfirmar(false);
        router.refresh();
      } catch (e) {
        toast((e as Error).message, "erro");
      }
    });

  const aviso = (t: string) => (
    <p className="text-muted" style={{ fontSize: 13, margin: 0, lineHeight: 1.45 }}>
      {t}
    </p>
  );
  const linha = (children: React.ReactNode) => (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>{children}</div>
  );

  if (!dia.util) return aviso(dia.feriado ? `Feriado: ${dia.feriado}.` : "Não é dia útil.");

  const encerrado = dia.passado || dia.hoje;
  const prazoTxt = dia.prazo ? horaSP(dia.prazo) : "";

  // ── Dia do meu grupo ──
  if (dia.meuDia) {
    if (ctx.afastado) return aviso("Você está afastado(a) — seu lugar fica livre para outra pessoa.");
    if (dia.ausente)
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {linha(<StatusTag tipo="neutro">{dia.ausenteEmCima ? "Ausência avisada (em cima da hora)" : "Ausência avisada"}</StatusTag>)}
          {!dia.passado &&
            linha(
              <button className="btn btn-secondary" disabled={pending} onClick={() => exec(() => desfazerAusencia(dia.data))}>
                Desfazer — vou comparecer
              </button>,
            )}
        </div>
      );
    if (dia.passado) return aviso("Dia do seu grupo.");
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {!compacto && linha(<StatusTag tipo="ok">Você está escalado(a) neste dia</StatusTag>)}
        {!confirmar ? (
          linha(
            <button className="btn btn-secondary" disabled={pending} onClick={() => setConfirmar(true)}>
              Não vou neste dia
            </button>,
          )
        ) : (
          <div className="card" style={{ gap: 8, padding: 12, background: "var(--warn-bg)", borderColor: "transparent" }}>
            <strong style={{ fontSize: 14 }}>Confirmar ausência em {dataLonga(dia.data)}?</strong>
            {aviso(
              dia.prazoPassou
                ? `O prazo (${prazoTxt}) já passou: a ausência fica registrada como "em cima da hora".`
                : "Seu lugar será liberado na hora para quem está na lista de espera.",
            )}
            {linha(
              <>
                <button className="btn btn-primary" disabled={pending} onClick={() => exec(() => naoVou(dia.data))}>
                  {pending ? "Registrando..." : "Confirmar ausência"}
                </button>
                <button className="btn btn-ghost" disabled={pending} onClick={() => setConfirmar(false)}>
                  Voltar
                </button>
              </>,
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Dia livre (ter–qui) ou do outro grupo: reserva / fila ──
  const r = dia.reserva;
  const f = dia.fila;
  if (r && (r.status === "CONFIRMADA" || r.status === "UTILIZADA")) {
    if (r.status === "UTILIZADA" || dia.passado) return linha(<StatusTag tipo="ok">Presença registrada</StatusTag>);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {linha(
          <>
            <StatusTag tipo="ok">Agendamento confirmado{r.origem === "FILA" ? " (pela lista de espera)" : ""}</StatusTag>
            {!dia.prazoPassou && !compacto && <span className="text-muted" style={{ fontSize: 12 }}>cancele até {prazoTxt}</span>}
          </>,
        )}
        {dia.prazoPassou
          ? aviso(`O prazo para cancelar terminou (${prazoTxt}). Se não puder ir, avise o RH.`)
          : linha(
              <button className="btn btn-secondary" disabled={pending} onClick={() => exec(() => cancelarReserva(r.id))}>
                Cancelar agendamento
              </button>,
            )}
      </div>
    );
  }

  if (f && f.status === "OFERECIDA" && f.expiraEm)
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {linha(
          <>
            <StatusTag tipo="warn">Vaga oferecida a você</StatusTag>
            <Contagem ate={f.expiraEm} />
          </>,
        )}
        {aviso(`Aceite até ${horaSP(f.expiraEm)}. Depois, a vaga passa para a próxima pessoa.`)}
        {linha(
          <>
            <button className="btn btn-primary" disabled={pending} onClick={() => exec(() => aceitarOferta(f.id))}>
              Aceitar vaga
            </button>
            <button className="btn btn-secondary" disabled={pending} onClick={() => exec(() => recusarOferta(f.id))}>
              Recusar
            </button>
          </>,
        )}
      </div>
    );

  if (f && f.status === "AGUARDANDO")
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {linha(<StatusTag tipo="accent">Lista de espera · {f.posicao ?? "?"}ª posição</StatusTag>)}
        {!compacto &&
          aviso(
            dia.prazoPassou
              ? "Se abrir uma vaga, ela será oferecida a você por e-mail com prazo para aceitar."
              : "Se abrir uma vaga até o prazo, ela é sua automaticamente e você recebe um e-mail.",
          )}
        {linha(
          <button className="btn btn-ghost" disabled={pending} onClick={() => exec(() => sairFila(f.id))}>
            Sair da lista de espera
          </button>,
        )}
      </div>
    );

  if (encerrado) return aviso(dia.hoje ? "Os agendamentos para hoje já foram encerrados." : "Este dia já passou.");
  if (ctx.afastado) return aviso("Durante o afastamento não é possível agendar nem entrar na lista de espera.");
  const usadas = ctx.reservasNoMes[dia.data.slice(0, 7)] ?? 0;
  if (ctx.limiteMensal !== null && usadas >= ctx.limiteMensal)
    return aviso(`Você atingiu o limite de ${ctx.limiteMensal} agendamentos neste mês.`);

  const o = dia.ocupacao;
  const temVaga = !!o && o.vagasDisponiveis > 0 && o.fila === 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {!compacto && o && linha(<span className="text-muted" style={{ fontSize: 13 }}>{textoVagas(dia)}</span>)}
      {linha(
        temVaga ? (
          <button className="btn btn-primary" disabled={pending} onClick={() => exec(() => reservar(dia.data))}>
            {pending ? "Agendando..." : "Agendar presença"}
          </button>
        ) : (
          <button className="btn btn-secondary" disabled={pending} onClick={() => exec(() => entrarFila(dia.data))}>
            {pending ? "Entrando..." : "Entrar na lista de espera"}
          </button>
        ),
      )}
      {!compacto && ctx.limiteMensal !== null && aviso(`Agendamentos neste mês: ${usadas} de ${ctx.limiteMensal}.`)}
    </div>
  );
}

/** Cabeçalho de um dia (data + grupo + contador). */
export function TituloDia({ dia }: { dia: DiaPortal }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <strong style={{ fontSize: 14.5 }}>{maiuscula(dataLonga(dia.data))}</strong>
      {dia.grupo ? <GrupoBadge grupo={dia.grupo} /> : dia.util && <LivreBadge />}
    </div>
  );
}

/** Dia livre (ter–qui): sem equipe fixa, aberto a agendamento. */
export function LivreBadge({ rotulo = false }: { rotulo?: boolean }) {
  return (
    <span className="tag tag-neutral" style={{ fontWeight: 700 }}>
      {rotulo ? "Dia livre" : "Livre"}
    </span>
  );
}
