"use client";

import { useState } from "react";
import Link from "next/link";
import { AcoesDia, Folha, LivreBadge, StatusTag } from "@/components/escala/AcoesDia";
import { GrupoBadge } from "@/components/escala/GrupoBadge";
import { dataLonga, maiuscula, nomeMes } from "@/lib/escala/formato";
import type { ContextoPortal, DiaPortal } from "@/lib/escala/portal";

const SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function mesVizinho(ref: string, delta: number): string {
  const [a, m] = ref.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

/** Uma linha curta de status para a célula. */
function resumoCelula(d: DiaPortal, ctx: ContextoPortal): string | null {
  if (!d.util) return d.feriado ?? null;
  if (d.meuDia) return ctx.afastado ? "Afastado(a)" : d.ausente ? "Ausência avisada" : "Seu dia";
  if (d.reserva?.status === "CONFIRMADA" || d.reserva?.status === "UTILIZADA") return "Agendado";
  if (d.fila?.status === "OFERECIDA") return "Vaga para você";
  if (d.fila?.status === "AGUARDANDO") return `${d.fila.posicao}º na espera`;
  if (d.hoje) return "Hoje";
  if (d.passado) return null;
  const o = d.ocupacao;
  if (!o) return null;
  return o.vagasDisponiveis > 0 && o.fila === 0 ? `${o.vagasDisponiveis} vaga${o.vagasDisponiveis > 1 ? "s" : ""}` : o.fila ? `Lotado · ${o.fila} na espera` : "Lotado";
}

export function CalendarioClient({
  refMes,
  dias,
  ctx,
  podeVoltar,
  podeAvancar,
}: {
  refMes: string;
  dias: DiaPortal[];
  ctx: ContextoPortal;
  podeVoltar: boolean;
  podeAvancar: boolean;
}) {
  const [aberto, setAberto] = useState<string | null>(null);
  const [ano, mes] = refMes.split("-").map(Number);
  const primeiroSem = new Date(Date.UTC(ano, mes - 1, 1)).getUTCDay();
  const dia = dias.find((d) => d.data === aberto) ?? null;

  return (
    <section className="card elev-sm" style={{ gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div>
          <div className="card-kicker">Calendário</div>
          <div className="card-title" style={{ fontSize: 24 }}>
            {maiuscula(nomeMes(mes))} de {ano}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {podeVoltar ? (
            <Link className="btn btn-secondary btn-icon" href={`/escala?mes=${mesVizinho(refMes, -1)}`} aria-label="Mês anterior">‹</Link>
          ) : (
            <span className="btn btn-secondary btn-icon" aria-disabled style={{ opacity: 0.4 }}>‹</span>
          )}
          {podeAvancar ? (
            <Link className="btn btn-secondary btn-icon" href={`/escala?mes=${mesVizinho(refMes, 1)}`} aria-label="Próximo mês">›</Link>
          ) : (
            <span className="btn btn-secondary btn-icon" aria-disabled style={{ opacity: 0.4 }}>›</span>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: "6px 16px", flexWrap: "wrap", alignItems: "center", fontSize: 12 }} className="text-muted">
        <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><GrupoBadge grupo="A" /> Grupo A</span>
        <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><GrupoBadge grupo="B" /> Grupo B</span>
        <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><LivreBadge /> Ter a qui: livre para agendar</span>
        <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
          <span aria-hidden style={{ width: 14, height: 14, borderRadius: 4, background: "var(--color-neutral-100)", border: "1px solid var(--color-divider)" }} />
          Fim de semana, feriado ou sem expediente
        </span>
      </div>

      <div
        className="esc-cal"
        role="grid"
        aria-label={`Escala de ${nomeMes(mes)}`}
        style={{ "--linhas": Math.ceil((primeiroSem + dias.length) / 7) } as React.CSSProperties}
      >
        {SEMANA.map((s) => (
          <div key={s} className="esc-cal-sem">{s}</div>
        ))}
        {Array.from({ length: primeiroSem }, (_, i) => (
          <div key={`v${i}`} className="esc-dia" data-fora="1" />
        ))}
        {dias.map((d) => {
          const cinza = !d.util;
          const resumo = resumoCelula(d, ctx);
          return (
            <button
              key={d.data}
              className="esc-dia"
              data-grupo={d.grupo ?? (d.util ? "livre" : undefined)}
              data-cinza={cinza ? "1" : undefined}
              data-passado={d.passado ? "1" : undefined}
              data-hoje={d.hoje ? "1" : undefined}
              onClick={() => !cinza && setAberto(d.data)}
              disabled={cinza && !d.feriado}
              aria-label={`${dataLonga(d.data)}${d.grupo ? `, Grupo ${d.grupo}` : d.util ? ", dia livre" : ""}${resumo ? `, ${resumo}` : ""}`}
              title={d.feriado ?? undefined}
            >
              <span className="esc-dia-num">
                {Number(d.data.slice(8))}
                {d.grupo ? <GrupoBadge grupo={d.grupo} /> : d.util && <LivreBadge />}
              </span>
              {resumo && (
                <span className="esc-dia-info" style={{ fontWeight: d.meuDia || d.reserva?.status === "CONFIRMADA" ? 700 : 400 }}>
                  {resumo}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {dia && (
        <Folha titulo={maiuscula(dataLonga(dia.data))} onFechar={() => setAberto(null)}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {dia.grupo ? <GrupoBadge grupo={dia.grupo} rotulo /> : <LivreBadge rotulo />}
            {!dia.grupo ? (
              <StatusTag tipo="neutro">Sem grupo fixo — qualquer pessoa pode agendar</StatusTag>
            ) : dia.meuDia ? (
              <StatusTag tipo="ok">Dia do seu grupo</StatusTag>
            ) : (
              <StatusTag tipo="neutro">Dia do outro grupo</StatusTag>
            )}
          </div>
          {dia.ocupacao && !dia.passado && (
            <div className="text-muted" style={{ fontSize: 13 }}>
              {dia.ocupacao.capacidade} lugares no escritório
              {dia.grupo ? ` · ${dia.ocupacao.escalados} escalados do Grupo ${dia.grupo}` : ` · ${dia.ocupacao.capacidade - dia.ocupacao.vagasLivres} agendados`}
            </div>
          )}
          <AcoesDia dia={dia} ctx={ctx} />
        </Folha>
      )}
    </section>
  );
}
