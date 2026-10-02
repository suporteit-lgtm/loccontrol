"use client";

import { useState } from "react";
import Link from "next/link";
import { AcoesDia, Folha, StatusTag } from "@/components/escala/AcoesDia";
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
  if (!d.grupo) return d.feriado ?? null;
  if (d.meuDia) return ctx.afastado ? "afastado" : d.ausente ? "você não vai" : "seu dia";
  if (d.reserva?.status === "CONFIRMADA" || d.reserva?.status === "UTILIZADA") return "reservado";
  if (d.fila?.status === "OFERECIDA") return "vaga oferecida!";
  if (d.fila?.status === "AGUARDANDO") return `fila: ${d.fila.posicao}º`;
  if (d.passado || d.hoje) return null;
  const o = d.ocupacao;
  if (!o) return null;
  return o.vagasDisponiveis > 0 && o.fila === 0 ? `${o.vagasDisponiveis} livre${o.vagasDisponiveis > 1 ? "s" : ""}` : o.fila ? `lotado · ${o.fila} fila` : "lotado";
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
          <div className="card-title">
            {maiuscula(nomeMes(mes))} de {ano}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {podeVoltar ? (
            <Link className="btn btn-secondary btn-icon" href={`/escala/calendario?mes=${mesVizinho(refMes, -1)}`} aria-label="Mês anterior">‹</Link>
          ) : (
            <span className="btn btn-secondary btn-icon" aria-disabled style={{ opacity: 0.4 }}>‹</span>
          )}
          {podeAvancar ? (
            <Link className="btn btn-secondary btn-icon" href={`/escala/calendario?mes=${mesVizinho(refMes, 1)}`} aria-label="Próximo mês">›</Link>
          ) : (
            <span className="btn btn-secondary btn-icon" aria-disabled style={{ opacity: 0.4 }}>›</span>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12 }} className="text-muted">
        <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><GrupoBadge grupo="A" /> Grupo A</span>
        <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><GrupoBadge grupo="B" /> Grupo B</span>
        <span>cinza = fim de semana, feriado ou sem expediente</span>
      </div>

      <div className="esc-cal" role="grid" aria-label={`Escala de ${nomeMes(mes)}`}>
        {SEMANA.map((s) => (
          <div key={s} className="esc-cal-sem">{s}</div>
        ))}
        {Array.from({ length: primeiroSem }, (_, i) => (
          <div key={`v${i}`} className="esc-dia" data-fora="1" />
        ))}
        {dias.map((d) => {
          const cinza = !d.grupo;
          const resumo = resumoCelula(d, ctx);
          return (
            <button
              key={d.data}
              className="esc-dia"
              data-grupo={d.grupo ?? undefined}
              data-cinza={cinza ? "1" : undefined}
              data-passado={d.passado ? "1" : undefined}
              data-hoje={d.hoje ? "1" : undefined}
              onClick={() => !cinza && setAberto(d.data)}
              disabled={cinza && !d.feriado}
              aria-label={`${dataLonga(d.data)}${d.grupo ? `, Grupo ${d.grupo}` : ""}${resumo ? `, ${resumo}` : ""}`}
              title={d.feriado ?? undefined}
            >
              <span className="esc-dia-num">
                {Number(d.data.slice(8))}
                {d.grupo && <GrupoBadge grupo={d.grupo} />}
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
            {dia.grupo && <GrupoBadge grupo={dia.grupo} rotulo />}
            {dia.meuDia ? <StatusTag tipo="ok">Dia do seu grupo</StatusTag> : <StatusTag tipo="neutro">Dia do outro grupo</StatusTag>}
          </div>
          {dia.ocupacao && !dia.passado && (
            <div className="text-muted" style={{ fontSize: 13 }}>
              {dia.ocupacao.capacidade} lugares no escritório · {dia.ocupacao.escalados} escalados do Grupo {dia.grupo}
            </div>
          )}
          <AcoesDia dia={dia} ctx={ctx} />
        </Folha>
      )}
    </section>
  );
}
