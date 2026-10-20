// Faixa da semana (Seg–Sex) mostrada nas telas de entrada: escolha de módulo e login do portal.
import { db } from "@/lib/db";
import { diaDaSemana, hojeSP, somarDias } from "./calendario";

export interface DiaSemana {
  nome: string; // "Seg"
  data: string; // AAAA-MM-DD
  /** dia útil da escala; com grupo nulo = dia livre (ter–qui) */
  util: boolean;
  grupo: "A" | "B" | null;
  feriado: string | null;
  hoje: boolean;
}

const NOMES = ["Seg", "Ter", "Qua", "Qui", "Sex"];

async function semana(unidade: string, segunda: string, hoje: string): Promise<DiaSemana[] | null> {
  const sexta = somarDias(segunda, 4);
  const [{ data: dias }, { data: feriados }] = await Promise.all([
    db().from("escala_dia").select("data, grupo").eq("unidade_id", unidade).gte("data", segunda).lte("data", sexta),
    db().from("escala_feriado").select("data, nome").or(`unidade_id.is.null,unidade_id.eq.${unidade}`)
      .gte("data", segunda).lte("data", sexta),
  ]);
  if (!dias?.length) return null;
  const grupo = new Map(dias.map((d) => [d.data as string, (d.grupo as "A" | "B" | null) ?? null]));
  const feriado = new Map((feriados ?? []).map((f) => [f.data as string, f.nome as string]));
  return NOMES.map((nome, i) => {
    const data = somarDias(segunda, i);
    return { nome, data, util: grupo.has(data), grupo: grupo.get(data) ?? null, feriado: feriado.get(data) ?? null, hoje: data === hoje };
  });
}

/** Semana útil corrente (no fim de semana, a próxima) da escala de BH · Centro. */
export async function semanaDaEscala(): Promise<DiaSemana[] | null> {
  try {
    const hoje = hojeSP();
    const dow = diaDaSemana(hoje); // 0 dom … 6 sáb
    const segunda = dow === 0 ? somarDias(hoje, 1) : dow === 6 ? somarDias(hoje, 2) : somarDias(hoje, 1 - dow);
    const { data: cfg } = await db().from("escala_config").select("unidade_id").not("data_ancora", "is", null).limit(1).maybeSingle();
    if (!cfg) return null;
    // semana atual sem escala: mostra a próxima
    return (await semana(cfg.unidade_id, segunda, hoje)) ?? (await semana(cfg.unidade_id, somarDias(segunda, 7), hoje));
  } catch {
    return null; // a tela de entrada nunca quebra por causa da escala
  }
}
