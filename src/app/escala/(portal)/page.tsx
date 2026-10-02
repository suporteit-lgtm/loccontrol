import { contaPortal } from "@/lib/escala/auth";
import { GrupoBadge } from "@/components/escala/GrupoBadge";

export const dynamic = "force-dynamic";

/** Início do portal (etapa 5 traz o card de hoje, próximos dias, reservas, fila e vagas). */
export default async function EscalaInicio() {
  const conta = (await contaPortal())!;
  const p = conta.participante!;
  return (
    <div className="card elev-sm" style={{ gap: 8 }}>
      <div className="card-kicker">Olá</div>
      <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {p.nome} <GrupoBadge grupo={p.grupo} rotulo />
      </div>
      <p className="card-body">{conta.email}</p>
    </div>
  );
}
