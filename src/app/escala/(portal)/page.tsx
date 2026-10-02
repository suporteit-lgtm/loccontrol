import { contaPortal } from "@/lib/escala/auth";
import { hojeSP, somarDias } from "@/lib/escala/calendario";
import { carregarDias, contextoPortal } from "@/lib/escala/portal";
import { InicioClient } from "./InicioClient";

export const dynamic = "force-dynamic";

export default async function EscalaInicio() {
  const conta = await contaPortal();
  const p = conta?.participante;
  if (!p?.ativo) return null; // o layout mostra o aviso

  const agora = new Date();
  const hoje = hojeSP(agora);
  const [dias, ctx] = await Promise.all([carregarDias(p, hoje, somarDias(hoje, 28), agora), contextoPortal(p, agora)]);
  return <InicioClient nome={p.nome.split(" ")[0]} grupo={p.grupo} dias={dias} ctx={ctx} />;
}
