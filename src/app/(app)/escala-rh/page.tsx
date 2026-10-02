import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { participantes, unidadeDaEscala } from "@/lib/escala/rh";

export const dynamic = "force-dynamic";

/** Provisório: o dashboard completo (seção 8) é o próximo passo. */
export default async function DashboardEscalaPage() {
  const u = await unidadeDaEscala();
  const lista = (await participantes(u.config.unidade_id)).filter((p) => p.ativo);
  const a = lista.filter((p) => p.grupo === "A").length;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <PageHeader eyebrow="Escala de Presença" titulo="Dashboard da Escala" sub={`${u.cidade} · ${u.unidade}`} />
      <section className="card elev-sm" style={{ gap: 8 }}>
        <div className="card-kicker">Em construção</div>
        <div className="card-title" style={{ fontSize: 17 }}>
          {lista.length} participante(s) · Grupo A {a} · Grupo B {lista.length - a}
        </div>
        <p className="card-body">
          Os cards de ocupação, ausências e fila, os gráficos e a frequência por pessoa entram aqui no próximo passo.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link className="btn btn-secondary" href="/escala-rh/participantes">Participantes</Link>
          <Link className="btn btn-secondary" href="/escala-rh/calendario">Calendário</Link>
        </div>
      </section>
    </div>
  );
}
