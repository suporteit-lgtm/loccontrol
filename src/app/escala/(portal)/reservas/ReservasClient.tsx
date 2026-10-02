"use client";

import { AcoesDia, StatusTag, TituloDia } from "@/components/escala/AcoesDia";
import { horaSP } from "@/lib/escala/formato";
import type { ContextoPortal, DiaPortal } from "@/lib/escala/portal";

const MOTIVO: Record<string, string> = {
  pessoa: "cancelada por você",
  admin: "cancelada pelo RH",
  feriado: "dia deixou de ser útil",
  grupo: "a escala mudou",
  afastado: "afastamento",
  desligado: "saída da escala",
};

function Status({ d }: { d: DiaPortal }) {
  const r = d.reserva;
  const f = d.fila;
  if (r?.status === "CONFIRMADA") return <StatusTag tipo="ok">Confirmada{r.origem === "FILA" ? " (via fila)" : ""}</StatusTag>;
  if (r?.status === "UTILIZADA") return <StatusTag tipo="neutro">Utilizada</StatusTag>;
  if (f?.status === "OFERECIDA" && f.expiraEm) return <StatusTag tipo="warn">Oferecida — aceitar até {horaSP(f.expiraEm)}</StatusTag>;
  if (f?.status === "AGUARDANDO") return <StatusTag tipo="accent">Na fila — posição {f.posicao}</StatusTag>;
  if (r?.status === "CANCELADA")
    return <StatusTag tipo="danger">Cancelada{r.motivo && MOTIVO[r.motivo] ? ` — ${MOTIVO[r.motivo]}` : ""}</StatusTag>;
  if (r?.status === "EXPIRADA" || f?.status === "EXPIRADA") return <StatusTag tipo="neutro">Expirada</StatusTag>;
  if (f?.status === "CANCELADA") return <StatusTag tipo="neutro">Saiu da fila</StatusTag>;
  if (f?.status === "ATENDIDA") return <StatusTag tipo="ok">Atendida</StatusTag>;
  return null;
}

const ativo = (d: DiaPortal) =>
  !d.passado && (d.reserva?.status === "CONFIRMADA" || d.fila?.status === "AGUARDANDO" || d.fila?.status === "OFERECIDA");

export function ReservasClient({ dias, ctx }: { dias: DiaPortal[]; ctx: ContextoPortal }) {
  const proximas = dias.filter(ativo);
  const historico = dias.filter((d) => !ativo(d)).reverse();
  const mes = ctx.hoje.slice(0, 7);

  return (
    <>
      <section className="card elev-sm">
        <div className="card-kicker">Minhas reservas</div>
        <div className="card-title" style={{ fontSize: 17 }}>Próximas</div>
        {ctx.limiteMensal !== null && (
          <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>
            Reservas usadas neste mês: {ctx.reservasNoMes[mes] ?? 0} de {ctx.limiteMensal}. Canceladas não contam.
          </p>
        )}
        {proximas.length === 0 ? (
          <p className="text-muted" style={{ fontSize: 13.5, margin: 0 }}>Nenhuma reserva ou posição na fila.</p>
        ) : (
          <div className="esc-lista">
            {proximas.map((d) => (
              <div key={d.data} className="esc-linha" style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <TituloDia dia={d} />
                  <Status d={d} />
                </div>
                {d.reserva?.status === "CONFIRMADA" && d.prazo && (
                  <span className="text-muted" style={{ fontSize: 12.5 }}>
                    {d.prazoPassou ? "Prazo de cancelamento encerrado" : `Cancelamento até ${horaSP(d.prazo)}`}
                  </span>
                )}
                <AcoesDia dia={d} ctx={ctx} compacto />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card elev-sm">
        <div className="card-kicker">Histórico</div>
        <div className="card-title" style={{ fontSize: 17 }}>Últimos 60 dias e anteriores</div>
        {historico.length === 0 ? (
          <p className="text-muted" style={{ fontSize: 13.5, margin: 0 }}>Nada por aqui ainda.</p>
        ) : (
          <div className="esc-lista">
            {historico.map((d) => (
              <div key={d.data} className="esc-linha" style={{ flexWrap: "wrap" }}>
                <TituloDia dia={d} />
                <Status d={d} />
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
