import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { usuarioAtual } from "@/lib/session";
import { escalaHabilitada } from "@/lib/escala/auth";
import { diaDaSemana, hojeSP, somarDias } from "@/lib/escala/calendario";
import { EscolhaModulo, type DiaSemana } from "./EscolhaModulo";

export const dynamic = "force-dynamic";

const NOMES = ["Seg", "Ter", "Qua", "Qui", "Sex"];

/** Semana útil corrente (no fim de semana, a próxima) da escala de BH · Centro. */
async function semanaDaEscala(): Promise<DiaSemana[] | null> {
  try {
    const hoje = hojeSP();
    const dow = diaDaSemana(hoje); // 0 dom … 6 sáb
    const segunda = dow === 0 ? somarDias(hoje, 1) : dow === 6 ? somarDias(hoje, 2) : somarDias(hoje, 1 - dow);
    const { data: cfg } = await db().from("escala_config").select("unidade_id").not("data_ancora", "is", null).limit(1).maybeSingle();
    if (!cfg) return null;
    // semana atual sem escala (ex.: antes da âncora): mostra a próxima
    return (await semana(cfg.unidade_id, segunda, hoje)) ?? (await semana(cfg.unidade_id, somarDias(segunda, 7), hoje));
  } catch {
    return null; // a escolha de módulo nunca quebra por causa da escala
  }
}

async function semana(unidade: string, segunda: string, hoje: string): Promise<DiaSemana[] | null> {
  const sexta = somarDias(segunda, 4);
  const [{ data: dias }, { data: feriados }] = await Promise.all([
    db().from("escala_dia").select("data, grupo").eq("unidade_id", unidade).gte("data", segunda).lte("data", sexta),
    db().from("escala_feriado").select("data, nome").or(`unidade_id.is.null,unidade_id.eq.${unidade}`)
      .gte("data", segunda).lte("data", sexta),
  ]);
  if (!dias?.length) return null;
  const grupo = new Map(dias.map((d) => [d.data as string, d.grupo as "A" | "B"]));
  const feriado = new Map((feriados ?? []).map((f) => [f.data as string, f.nome as string]));
  return NOMES.map((nome, i) => {
    const data = somarDias(segunda, i);
    return { nome, data, grupo: grupo.get(data) ?? null, feriado: feriado.get(data) ?? null, hoje: data === hoje };
  });
}

export default async function Home() {
  // com a Escala liberada, a entrada é a escolha do módulo
  if (escalaHabilitada()) return <EscolhaModulo semana={await semanaDaEscala()} />;
  const u = await usuarioAtual();
  if (!u) redirect("/login");
  redirect(u.papel.includes("T.I") ? "/dash-ti" : "/dash");
}
