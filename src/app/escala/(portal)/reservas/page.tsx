import { contaPortal } from "@/lib/escala/auth";
import { hojeSP, somarDias } from "@/lib/escala/calendario";
import { carregarDias, contextoPortal } from "@/lib/escala/portal";
import { ReservasClient } from "./ReservasClient";

export const dynamic = "force-dynamic";

export default async function EscalaReservas() {
  const conta = await contaPortal();
  const p = conta?.participante;
  if (!p?.ativo) return null;

  const agora = new Date();
  const hoje = hojeSP(agora);
  const [dias, ctx] = await Promise.all([
    carregarDias(p, somarDias(hoje, -60), somarDias(hoje, 92), agora, false),
    contextoPortal(p, agora),
  ]);
  const comRegistro = dias.filter((d) => d.reserva || d.fila);
  return <ReservasClient dias={comRegistro} ctx={ctx} />;
}
