"use client";

import Link from "next/link";
import { GrupoBadge } from "@/components/escala/GrupoBadge";
import { AcoesDia, LivreBadge, StatusTag, TituloDia, textoVagas } from "@/components/escala/AcoesDia";
import { dataLonga, maiuscula } from "@/lib/escala/formato";
import type { ContextoPortal, DiaPortal } from "@/lib/escala/portal";

/** "hoje", "amanhã", "em 3 dias" */
function quando(data: string, hoje: string): string {
  const n = Math.round((Date.parse(data) - Date.parse(hoje)) / 86_400_000);
  return n <= 0 ? "hoje" : n === 1 ? "amanhã" : `em ${n} dias`;
}

function Bloco({ kicker, titulo, children, vazio }: { kicker: string; titulo: string; children?: React.ReactNode; vazio?: string }) {
  return (
    <section className="card elev-sm">
      <div className="card-kicker">{kicker}</div>
      <div className="card-title" style={{ fontSize: 17 }}>{titulo}</div>
      {children ?? <p className="text-muted" style={{ fontSize: 13.5, margin: 0 }}>{vazio}</p>}
    </section>
  );
}

export function MeusDiasClient({ nome, grupo, dias, ctx }: { nome: string; grupo: "A" | "B"; dias: DiaPortal[]; ctx: ContextoPortal }) {
  const hoje = dias.find((d) => d.hoje)!;
  const futuros = dias.filter((d) => d.data > ctx.hoje && d.util);
  const ofertas = dias.filter((d) => d.fila?.status === "OFERECIDA" && d.fila.expiraEm && new Date(d.fila.expiraEm) > new Date());
  const proximos = dias.filter((d) => d.data >= ctx.hoje && d.meuDia).slice(0, 5);
  const meus = futuros.filter((d) => !d.meuDia && (d.reserva?.status === "CONFIRMADA" || d.fila?.status === "AGUARDANDO"));
  const vagas = futuros
    .filter((d) => !d.meuDia && !d.reserva?.status?.match(/CONFIRMADA|UTILIZADA/) && !d.fila?.status?.match(/AGUARDANDO|OFERECIDA/))
    .slice(0, 6);

  // card de hoje
  let hojeTexto: string;
  let hojeTom: "ok" | "neutro" | "warn" = "neutro";
  if (!hoje.util) hojeTexto = hoje.feriado ? `Hoje é feriado: ${hoje.feriado}.` : "Hoje não é dia útil.";
  else if (!hoje.grupo) {
    const reservou = hoje.reserva?.status === "CONFIRMADA" || hoje.reserva?.status === "UTILIZADA";
    hojeTexto = reservou ? "Você agendou presença hoje." : "Hoje não há grupo fixo — qualquer pessoa pode agendar.";
    if (reservou) hojeTom = "ok";
  }
  else if (hoje.meuDia && ctx.afastado) hojeTexto = "Você está afastado(a) — hoje o seu lugar fica livre.";
  else if (hoje.meuDia && hoje.ausente) hojeTexto = "Hoje é o dia do seu grupo, e você avisou que não vem.";
  else if (hoje.meuDia) {
    hojeTexto = "Hoje é o dia do seu grupo no escritório.";
    hojeTom = "ok";
  } else if (hoje.reserva?.status === "CONFIRMADA" || hoje.reserva?.status === "UTILIZADA") {
    hojeTexto = "Você agendou presença hoje.";
    hojeTom = "ok";
  } else hojeTexto = "Hoje não é o dia do seu grupo.";

  return (
    <>
      <section className="card elev-sm" style={{ gap: 10 }}>
        <div className="card-kicker" style={{ textTransform: "none", letterSpacing: 0, fontSize: 12 }}>
          Olá, {nome} · você é do <GrupoBadge grupo={grupo} rotulo />
        </div>
        <div className="card-title">{maiuscula(dataLonga(ctx.hoje))}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {hoje.grupo ? <GrupoBadge grupo={hoje.grupo} rotulo /> : hoje.util && <LivreBadge rotulo />}
          <StatusTag tipo={hojeTom}>{hojeTexto}</StatusTag>
        </div>
        {hoje.grupo && hoje.meuDia && !ctx.afastado && <AcoesDia dia={hoje} ctx={ctx} compacto />}
      </section>

      {ofertas.length > 0 && (
        <Bloco kicker="Ação necessária" titulo="Vaga oferecida a você">
          <div className="esc-lista">
            {ofertas.map((d) => (
              <div key={d.data} className="esc-linha" style={{ flexDirection: "column", alignItems: "stretch" }}>
                <TituloDia dia={d} />
                <AcoesDia dia={d} ctx={ctx} />
              </div>
            ))}
          </div>
        </Bloco>
      )}

      <Bloco kicker="Seus próximos dias" titulo="Dias fixos do seu grupo" vazio={ctx.afastado ? "Você está afastado." : "Nenhum dia nas próximas semanas."}>
        {proximos.length > 0 && !ctx.afastado ? (
          <div className="esc-lista">
            {proximos.map((d) => (
              <div key={d.data} className="esc-linha" style={{ flexWrap: "wrap" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <TituloDia dia={d} />
                  <span className="text-muted" style={{ fontSize: 12.5 }}>
                    {maiuscula(quando(d.data, ctx.hoje))}
                    {d.ausente ? " · ausência avisada" : ""}
                  </span>
                </div>
                <AcoesDia dia={d} ctx={ctx} compacto />
              </div>
            ))}
          </div>
        ) : undefined}
      </Bloco>

      <Bloco kicker="Agendamentos e lista de espera" titulo="Seus dias extras" vazio="Você não tem agendamentos nem está em lista de espera.">
        {meus.length > 0 ? (
          <div className="esc-lista">
            {meus.map((d) => (
              <div key={d.data} className="esc-linha" style={{ flexWrap: "wrap" }}>
                <TituloDia dia={d} />
                <AcoesDia dia={d} ctx={ctx} compacto />
              </div>
            ))}
            <Link href="/escala/reservas" className="btn btn-ghost" style={{ alignSelf: "flex-start", marginTop: 6 }}>
              Ver todas →
            </Link>
          </div>
        ) : undefined}
      </Bloco>

      <Bloco
        kicker="Vagas livres"
        titulo="Agendar outro dia"
        vazio={ctx.afastado ? "Durante o afastamento não é possível agendar." : "Sem dias disponíveis nas próximas semanas."}
      >
        {vagas.length > 0 && !ctx.afastado ? (
          <div className="esc-lista">
            {vagas.map((d) => (
              <div key={d.data} className="esc-linha" style={{ flexWrap: "wrap" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <TituloDia dia={d} />
                  <span className="text-muted" style={{ fontSize: 12.5 }}>{maiuscula(quando(d.data, ctx.hoje))} · {textoVagas(d)}</span>
                </div>
                <AcoesDia dia={d} ctx={ctx} compacto />
              </div>
            ))}
            <Link href="/escala" className="btn btn-ghost" style={{ alignSelf: "flex-start", marginTop: 6 }}>
              Ver calendário →
            </Link>
          </div>
        ) : undefined}
      </Bloco>
    </>
  );
}
