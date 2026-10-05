import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, StatCard, StatusPill } from "@/components/ui";
import { GrupoBadge } from "@/components/escala/GrupoBadge";
import { StatusTag } from "@/components/escala/AcoesDia";
import { detalhePessoa } from "@/lib/escala/dashboard";
import { dataCurta, horaSP } from "@/lib/escala/formato";

export const dynamic = "force-dynamic";

const MOTIVO: Record<string, string> = {
  pessoa: "pela pessoa",
  admin: "pelo RH",
  feriado: "feriado",
  grupo: "virou dia do grupo",
  remanejamento: "remanejamento",
  afastado: "afastamento",
  desligado: "saída da escala",
};
const TOM_RESERVA = { CONFIRMADA: "ok", UTILIZADA: "neutro", CANCELADA: "danger", EXPIRADA: "neutro" } as const;
const TOM_FILA = { AGUARDANDO: "accent", OFERECIDA: "warn", ATENDIDA: "ok", EXPIRADA: "neutro", CANCELADA: "neutro" } as const;

/** Detalhe do colaborador no Dashboard da Escala: presenças, ausências, reservas e fila. */
export default async function PessoaEscalaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await detalhePessoa(id);
  if (!d) notFound();
  const { pessoa: p, resumo: r } = d;
  const pct = r.frequencia === null ? "—" : `${r.frequencia.toLocaleString("pt-BR")}%`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <PageHeader
        eyebrow="Dashboard da Escala · histórico"
        titulo={p.nome}
        sub={<span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}><GrupoBadge grupo={p.grupo} rotulo /> {d.unidade} · <StatusPill status={p.status} />{!p.ativo && " · fora da escala"}</span>}
        acoes={<Link href="/escala-rh" className="btn btn-secondary">← Voltar ao dashboard</Link>}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "var(--space-3)" }}>
        <StatCard label="Frequência" n={pct} cor="var(--color-accent-700)" rodape="presenças ÷ escalados não afastados" />
        <StatCard label="Dias escalados" n={r.escalados} cor="var(--color-text)" />
        <StatCard label="Presenças" n={r.presencas} cor="var(--ok)" />
        <StatCard label="Ausências" n={r.ausencias} cor="var(--warn-forte)" rodape={`${r.emCima} em cima da hora`} />
        <StatCard label="Reservas usadas" n={r.reservasUsadas} cor="var(--ok)" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "var(--space-4)" }}>
        <section className="card elev-sm">
          <span className="card-kicker">Dias fixos do grupo (até hoje)</span>
          <span className="card-title">Presenças e ausências</span>
          {d.escalas.length === 0 ? (
            <p className="text-muted" style={{ fontSize: 13 }}>Nenhum dia escalado ainda.</p>
          ) : (
            <div className="esc-lista" style={{ maxHeight: 420, overflowY: "auto" }}>
              {d.escalas.map((e) => (
                <div key={e.data} className="esc-linha" style={{ padding: "7px 0", fontSize: 13.5 }}>
                  <span>{dataCurta(e.data)}</span>
                  {e.afastado ? (
                    <StatusTag tipo="warn">afastado</StatusTag>
                  ) : e.ausente ? (
                    <StatusTag tipo={e.ausente_em_cima ? "warn" : "neutro"}>{e.ausente_em_cima ? "ausente (em cima da hora)" : "avisou que não ia"}</StatusTag>
                  ) : (
                    <StatusTag tipo="ok">presente</StatusTag>
                  )}
                </div>
              ))}
            </div>
          )}
          {d.afastamentos.length > 0 && (
            <p className="text-muted" style={{ fontSize: 12.5, margin: 0 }}>
              Afastamentos: {d.afastamentos.map((a) => `${dataCurta(a.inicio)} a ${a.fim ? dataCurta(a.fim) : "hoje"}`).join(" · ")} (sem motivo — LGPD)
            </p>
          )}
        </section>

        <section className="card elev-sm">
          <span className="card-kicker">Agendamentos</span>
          <span className="card-title">Reservas</span>
          {d.reservas.length === 0 ? (
            <p className="text-muted" style={{ fontSize: 13 }}>Nenhuma reserva.</p>
          ) : (
            <div className="esc-lista" style={{ maxHeight: 420, overflowY: "auto" }}>
              {d.reservas.map((x) => (
                <div key={x.id} className="esc-linha" style={{ padding: "7px 0", fontSize: 13.5 }}>
                  <span>
                    {dataCurta(x.data)}
                    {x.origem === "FILA" && <span className="text-muted" style={{ fontSize: 11 }}> · via fila</span>}
                  </span>
                  <StatusTag tipo={TOM_RESERVA[x.status as keyof typeof TOM_RESERVA] ?? "neutro"}>
                    {x.status.toLowerCase()}
                    {x.status === "CANCELADA" && x.motivo_cancelamento ? ` — ${MOTIVO[x.motivo_cancelamento] ?? x.motivo_cancelamento}` : ""}
                  </StatusTag>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card elev-sm">
          <span className="card-kicker">Lista de espera</span>
          <span className="card-title">Fila</span>
          {d.fila.length === 0 ? (
            <p className="text-muted" style={{ fontSize: 13 }}>Nunca entrou na fila.</p>
          ) : (
            <div className="esc-lista" style={{ maxHeight: 420, overflowY: "auto" }}>
              {d.fila.map((x) => (
                <div key={x.id} className="esc-linha" style={{ padding: "7px 0", fontSize: 13.5 }}>
                  <span>
                    {dataCurta(x.data)} <span className="text-muted" style={{ fontSize: 11 }}>· entrou {horaSP(x.entrou_em)}</span>
                  </span>
                  <StatusTag tipo={TOM_FILA[x.status as keyof typeof TOM_FILA] ?? "neutro"}>{x.status.toLowerCase()}</StatusTag>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
