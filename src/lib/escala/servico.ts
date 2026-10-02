// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  Escala de Presença — serviços do servidor (banco via service_role)       ║
// ║  As regras de ocupação estão nas funções SQL (0025); aqui ficam a         ║
// ║  materialização, os feriados e a leitura de configuração.                 ║
// ╚══════════════════════════════════════════════════════════════════════════╝
import { db } from "@/lib/db";
import { hojeSP, materializar, prazoDoDia, somarDias, type Grupo } from "./calendario";

export const DIAS_MATERIALIZADOS = 90;

export interface ConfigEscala {
  unidade_id: string;
  habilitado: boolean;
  capacidade: number;
  data_ancora: string | null;
  grupo_inicial: Grupo;
  limite_mensal: number | null; // null = sem limite
  prazo_hora: string; // "18:00:00"
  oferta_validade_min: number;
  lembrete_hora: string;
  resumo_dia_semana: number;
  resumo_hora: string;
  calendario_id: string | null;
}

/** Única unidade com escala hoje (BH · Centro); preparado para mais de uma. */
export async function configs(): Promise<ConfigEscala[]> {
  const { data, error } = await db().from("escala_config").select("*");
  if (error) throw new Error(error.message);
  return (data ?? []) as ConfigEscala[];
}

export async function configDa(unidadeId: string): Promise<ConfigEscala> {
  const { data, error } = await db().from("escala_config").select("*").eq("unidade_id", unidadeId).single();
  if (error) throw new Error(error.message);
  return data as ConfigEscala;
}

export interface Feriado {
  id: string;
  data: string;
  nome: string;
  unidade_id: string | null;
  origem: "NACIONAL_API" | "MANUAL";
  sem_expediente: boolean;
}

/** Feriados nacionais + os da unidade, num intervalo. */
export async function feriadosDa(unidadeId: string, de: string, ate: string): Promise<Feriado[]> {
  const { data, error } = await db()
    .from("escala_feriado")
    .select("*")
    .or(`unidade_id.is.null,unidade_id.eq.${unidadeId}`)
    .gte("data", de)
    .lte("data", ate)
    .order("data");
  if (error) throw new Error(error.message);
  return (data ?? []) as Feriado[];
}

/**
 * Recalcula a escala da unidade de hoje até +90 dias (seg/sex fixas, ter–qui livres).
 * O passado fica congelado no banco.
 * Devolve o que a função SQL informou (dias removidos/alterados e reservas canceladas).
 */
export async function materializarUnidade(unidadeId: string, motivo = "feriado", agora = new Date()) {
  const cfg = await configDa(unidadeId);
  if (!cfg.data_ancora) return { ok: false as const, erro: "Defina a data âncora em Configurações da Escala." };

  const hoje = hojeSP(agora);
  const ate = somarDias(hoje, DIAS_MATERIALIZADOS);
  // feriados com folga para calcular o prazo do 1º dia (dia útil anterior)
  const feriados = new Set((await feriadosDa(unidadeId, somarDias(hoje, -30), somarDias(ate, 10))).map((f) => f.data));

  const prazoHora = cfg.prazo_hora.slice(0, 5);
  const dias = materializar({
    de: hoje,
    ate,
    params: { ancora: cfg.data_ancora, grupoInicial: cfg.grupo_inicial },
    feriados,
  }).map((d) => ({ ...d, prazo: prazoDoDia(d.data, prazoHora, feriados).toISOString() }));

  const { data, error } = await db().rpc("escala_aplicar_materializacao", {
    p_unidade: unidadeId,
    p_dias: dias,
    p_de: hoje,
    p_ate: ate,
    p_motivo: motivo,
    p_agora: agora.toISOString(),
  });
  if (error) return { ok: false as const, erro: error.message };
  return { ok: true as const, ...(data as Record<string, unknown>) };
}

// ── Feriados nacionais (BrasilAPI) ───────────────────────────────────────────
export async function importarFeriadosNacionais(
  ano: number,
  ator = "automação",
): Promise<{ ok: boolean; novos: number; erro?: string }> {
  let lista: { date: string; name: string }[];
  try {
    const r = await fetch(`https://brasilapi.com.br/api/feriados/v1/${ano}`, {
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    if (!r.ok) return { ok: false, novos: 0, erro: `BrasilAPI respondeu HTTP ${r.status}` };
    lista = await r.json();
  } catch (e) {
    return { ok: false, novos: 0, erro: `BrasilAPI indisponível: ${(e as Error).message}` };
  }

  // idempotente: só insere datas nacionais que ainda não existem; nunca apaga manuais
  const { data: existentes } = await db()
    .from("escala_feriado")
    .select("data")
    .is("unidade_id", null)
    .gte("data", `${ano}-01-01`)
    .lte("data", `${ano}-12-31`);
  const ja = new Set((existentes ?? []).map((f) => f.data));
  const novos = lista
    .filter((f) => !ja.has(f.date))
    .map((f) => ({ data: f.date, nome: f.name, unidade_id: null, origem: "NACIONAL_API", criado_por: ator }));
  if (novos.length) {
    const { error } = await db().from("escala_feriado").insert(novos);
    if (error) return { ok: false, novos: 0, erro: error.message };
  }
  return { ok: true, novos: novos.length };
}
