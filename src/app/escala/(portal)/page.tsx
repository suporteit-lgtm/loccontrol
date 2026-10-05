import { contaPortal } from "@/lib/escala/auth";
import { hojeSP, somarDias } from "@/lib/escala/calendario";
import { carregarDias, contextoPortal } from "@/lib/escala/portal";
import { CalendarioClient } from "./CalendarioClient";

export const dynamic = "force-dynamic";

function ultimoDia(ano: number, mes: number): string {
  return new Date(Date.UTC(ano, mes, 0)).toISOString().slice(0, 10);
}

export default async function EscalaCalendario({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const conta = await contaPortal();
  const p = conta?.participante;
  if (!p?.ativo) return null;

  const agora = new Date();
  const hoje = hojeSP(agora);
  const { mes } = await searchParams;
  const ref = /^\d{4}-\d{2}$/.test(mes ?? "") ? mes! : hoje.slice(0, 7);
  const [ano, m] = ref.split("-").map(Number);
  const de = `${ref}-01`;
  const ate = ultimoDia(ano, m);

  const [dias, ctx] = await Promise.all([carregarDias(p, de, ate, agora), contextoPortal(p, agora)]);
  // navegação: do mês atual até onde a escala está materializada (~90 dias)
  const limite = somarDias(hoje, 92).slice(0, 7);
  return <CalendarioClient refMes={ref} dias={dias} ctx={ctx} podeVoltar={ref > hoje.slice(0, 7)} podeAvancar={ref < limite} />;
}
