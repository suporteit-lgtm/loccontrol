// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  Automações da Escala. Todas idempotentes; cada execução fica registrada  ║
// ║  em escala_log_job (tarefa, início, fim, status, itens, erro).            ║
// ║  Disparo: /api/escala/cron/[tarefa] (CRON_SECRET) ou "Rodar agora".       ║
// ╚══════════════════════════════════════════════════════════════════════════╝
import { db } from "@/lib/db";
import { hojeSP } from "./calendario";
import { configs, importarFeriadosNacionais, materializarUnidade } from "./servico";
import { processarAcoes, type Acao } from "./acoes";
import { lerModos } from "./envio";

export const TAREFAS = {
  "materializar": "Materialização da escala (90 dias)",
  "feriados": "Importação de feriados nacionais",
  "expirar-ofertas": "Expiração de ofertas e encerramento das filas",
  "marcar-utilizadas": "Marcação de reservas como utilizadas",
  "eventos": "Eventos internos (status do colaborador)",
} as const;
export type Tarefa = keyof typeof TAREFAS;

export function ehTarefa(t: string): t is Tarefa {
  return t in TAREFAS;
}

type Execucao = { itens: number; detalhe?: unknown };

async function materializarTodas(): Promise<Execucao> {
  let itens = 0;
  const detalhe: unknown[] = [];
  for (const cfg of await configs()) {
    if (!cfg.data_ancora) continue;
    const r = await materializarUnidade(cfg.unidade_id, "feriado");
    if (!r.ok) throw new Error(r.erro);
    const canceladas = (r as { canceladas?: Acao[] }).canceladas ?? [];
    await processarAcoes([...canceladas, ...((r as { acoes?: Acao[] }).acoes ?? [])]);
    itens += ((r as { removidos?: unknown[] }).removidos?.length ?? 0) + ((r as { alterados?: unknown[] }).alterados?.length ?? 0);
    detalhe.push(r);
  }
  return { itens, detalhe };
}

async function feriados(): Promise<Execucao> {
  const ano = Number(hojeSP().slice(0, 4));
  let itens = 0;
  // em dezembro (job anual) basta o seguinte; manualmente, garante o corrente também
  for (const a of [ano, ano + 1]) {
    const r = await importarFeriadosNacionais(a);
    if (!r.ok) throw new Error(r.erro);
    itens += r.novos;
  }
  if (itens) await materializarTodas(); // feriado novo recalcula os dias futuros
  return { itens };
}

async function expirarOfertas(): Promise<Execucao> {
  const { data, error } = await db().rpc("escala_expirar_ofertas", {});
  if (error) throw new Error(error.message);
  const r = data as { expiradas: number; encerradas: number; acoes: Acao[] };
  await processarAcoes(r.acoes);
  return { itens: r.expiradas + r.encerradas, detalhe: r };
}

async function marcarUtilizadas(): Promise<Execucao> {
  const { data, error } = await db().rpc("escala_marcar_utilizadas", {});
  if (error) throw new Error(error.message);
  return { itens: data as number };
}

/** Processa a fila escala_evento (gravada pelo trigger de status do colaborador). */
export async function processarEventos(): Promise<Execucao> {
  const { data: eventos } = await db()
    .from("escala_evento")
    .select("*")
    .is("processado_em", null)
    .order("id")
    .limit(100);
  const modos = await lerModos();
  let itens = 0;
  for (const ev of eventos ?? []) {
    try {
      if (ev.tipo === "STATUS_COLABORADOR") {
        const { data, error } = await db().rpc("escala_aplicar_status", {
          p_colaborador: ev.payload.colaborador_id,
          p_status: ev.payload.para,
        });
        if (error) throw new Error(error.message);
        const r = data as { canceladas?: Acao[]; acoes?: Acao[] };
        await processarAcoes([...(r.canceladas ?? []), ...(r.acoes ?? [])], modos);
      }
      await db().from("escala_evento").update({ processado_em: new Date().toISOString(), erro: null }).eq("id", ev.id);
      itens++;
    } catch (e) {
      await db().from("escala_evento").update({ erro: (e as Error).message }).eq("id", ev.id);
    }
  }
  return { itens };
}

const EXECUTORES: Record<Tarefa, () => Promise<Execucao>> = {
  "materializar": materializarTodas,
  "feriados": feriados,
  "expirar-ofertas": expirarOfertas,
  "marcar-utilizadas": marcarUtilizadas,
  "eventos": processarEventos,
};

export async function rodarTarefa(tarefa: Tarefa, disparadoPor = "cron") {
  const { data: log } = await db()
    .from("escala_log_job")
    .insert({ tarefa, disparado_por: disparadoPor })
    .select("id")
    .single();
  try {
    const r = await EXECUTORES[tarefa]();
    await db()
      .from("escala_log_job")
      .update({ fim: new Date().toISOString(), status: "OK", itens: r.itens })
      .eq("id", log!.id);
    return { ok: true as const, tarefa, ...r };
  } catch (e) {
    const erro = (e as Error).message;
    await db().from("escala_log_job").update({ fim: new Date().toISOString(), status: "ERRO", erro }).eq("id", log!.id);
    return { ok: false as const, tarefa, erro };
  }
}
