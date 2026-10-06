// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  Automações da Escala. Todas idempotentes; cada execução fica registrada  ║
// ║  em escala_log_job (tarefa, início, fim, status, itens, erro).            ║
// ║  Disparo: pg_cron chama /api/escala/cron/ciclo a cada 10 min (CRON_SECRET) ║
// ║  e o "ciclo" decide o que está na hora — os horários vêm das              ║
// ║  Configurações da Escala. "Rodar agora" executa uma tarefa na hora.       ║
// ╚══════════════════════════════════════════════════════════════════════════╝
import { db } from "@/lib/db";
import { diaDaSemana, hojeSP } from "./calendario";
import { configs, importarFeriadosNacionais, materializarUnidade } from "./servico";
import { processarAcoes, type Acao } from "./acoes";
import { lerModos } from "./envio";
import { avisarMudancasDaEscala, enviarLembretes, enviarResumoSemanal } from "./avisos";
import { sincronizarGoogle } from "./google";

export const TAREFAS = {
  "ciclo": "Ciclo automático (a cada 10 min: decide o que está na hora)",
  "materializar": "Materialização da escala (90 dias) — diária, 01:00",
  "feriados": "Importação de feriados nacionais — anual, 1º/dez 03:00",
  "expirar-ofertas": "Expiração de ofertas e encerramento das filas — a cada 10 min",
  "marcar-utilizadas": "Marcação de reservas como utilizadas — diária, 23:00",
  "eventos": "Eventos internos (status do colaborador) — na hora e a cada 10 min",
  "lembretes": "Lembrete da véspera — dia útil anterior, no horário configurado",
  "resumo": "Resumo semanal para o RH — dia e hora configurados",
  "google": "Sincronização com o Google Agenda e os grupos — a cada 30 min e na hora em mudanças",
} as const;
export type Tarefa = keyof typeof TAREFAS;

export function ehTarefa(t: string): t is Tarefa {
  return t in TAREFAS;
}

type Execucao = { itens: number; detalhe?: unknown };

/** Rematerializa uma unidade e trata os efeitos (cancelamentos, vagas, avisos de mudança). */
export async function rematerializarComAvisos(unidadeId: string, motivo: string) {
  const r = await materializarUnidade(unidadeId, motivo);
  if (!r.ok) throw new Error(r.erro);
  const x = r as unknown as { canceladas?: Acao[]; acoes?: Acao[]; removidos?: { data: string }[]; alterados?: string[] };
  const modos = await lerModos();
  await processarAcoes([...(x.canceladas ?? []), ...(x.acoes ?? [])], modos);
  await avisarMudancasDaEscala(unidadeId, x, modos);
  return x;
}

async function materializarTodas(): Promise<Execucao> {
  let itens = 0;
  for (const cfg of await configs()) {
    if (!cfg.data_ancora) continue;
    const x = await rematerializarComAvisos(cfg.unidade_id, "feriado");
    itens += (x.removidos?.length ?? 0) + (x.alterados?.length ?? 0);
  }
  return { itens };
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

async function lembretes(): Promise<Execucao> {
  const modos = await lerModos();
  let itens = 0;
  for (const cfg of await configs()) if (cfg.data_ancora) itens += await enviarLembretes(cfg, new Date(), modos);
  return { itens };
}

async function resumo(): Promise<Execucao> {
  return { itens: await enviarResumoSemanal() };
}

// ── Ciclo: o que está na hora? ───────────────────────────────────────────────
/** Hora local de São Paulo "HH:MM". */
function horaSPAgora(agora: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(agora);
}

async function ultimoOk(tarefa: Tarefa): Promise<string | null> {
  const { data } = await db()
    .from("escala_log_job")
    .select("inicio")
    .eq("tarefa", tarefa)
    .eq("status", "OK")
    .order("inicio", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.inicio ?? null;
}

/** Tarefa diária: roda uma vez por dia (data de SP), a partir do horário. */
async function devida(tarefa: Tarefa, horario: string, agora: Date): Promise<boolean> {
  if (horaSPAgora(agora) < horario.slice(0, 5)) return false;
  const u = await ultimoOk(tarefa);
  return !u || hojeSP(new Date(u)) !== hojeSP(agora);
}

/** Decide o que rodar agora. Exportada para teste. */
export async function tarefasDoCiclo(agora = new Date()): Promise<Tarefa[]> {
  const cfg = (await configs())[0];
  const hoje = hojeSP(agora);
  const lista: Tarefa[] = ["eventos", "expirar-ofertas"];
  if (await devida("materializar", "01:00", agora)) lista.push("materializar");
  if (await devida("marcar-utilizadas", "23:00", agora)) lista.push("marcar-utilizadas");
  if (hoje.slice(5) >= "12-01" && (await devida("feriados", "03:00", agora))) {
    const u = await ultimoOk("feriados");
    if (!u || hojeSP(new Date(u)) < `${hoje.slice(0, 4)}-12-01`) lista.push("feriados");
  }
  // Google: a cada 30 min, só quando o modo não é DESLIGADO
  if ((await lerModos()).modo_google !== "DESLIGADO") {
    const g = await ultimoOk("google");
    if (!g || agora.getTime() - Date.parse(g) >= 29 * 60_000) lista.push("google");
  }
  if (cfg && (await devida("lembretes", cfg.lembrete_hora, agora))) lista.push("lembretes");
  if (cfg && diaDaSemana(hoje) === cfg.resumo_dia_semana && (await devida("resumo", cfg.resumo_hora, agora))) lista.push("resumo");
  return lista;
}

async function ciclo(): Promise<Execucao> {
  const feitas: Record<string, unknown> = {};
  let itens = 0;
  for (const t of await tarefasDoCiclo()) {
    // as frequentes só deixam log quando fazem algo (senão seriam 288 linhas por dia)
    const r = await rodarTarefa(t, "cron", t === "eventos" || t === "expirar-ofertas");
    feitas[t] = r.ok ? r.itens : `ERRO: ${r.erro}`;
    if (r.ok) itens += r.itens;
  }
  return { itens, detalhe: feitas };
}

/**
 * Uma sincronização com o Google por vez: se outra (mais antiga) ainda está
 * RODANDO, espera ela terminar (até ~30 s) antes de ler o estado e mexer na
 * agenda — duas ao mesmo tempo poderiam criar o mesmo evento duas vezes.
 */
async function aguardarGoogleAnterior(logId: number | null) {
  if (!logId) return;
  for (let i = 0; i < 15; i++) {
    const { count } = await db()
      .from("escala_log_job")
      .select("id", { count: "exact", head: true })
      .eq("tarefa", "google")
      .eq("status", "RODANDO")
      .lt("id", logId)
      .gt("inicio", new Date(Date.now() - 3 * 60_000).toISOString());
    if (!count) return;
    await new Promise((r) => setTimeout(r, 2000));
  }
}

const EXECUTORES: Record<Tarefa, () => Promise<Execucao>> = {
  "ciclo": ciclo,
  "materializar": materializarTodas,
  "feriados": feriados,
  "expirar-ofertas": expirarOfertas,
  "marcar-utilizadas": marcarUtilizadas,
  "eventos": processarEventos,
  "lembretes": lembretes,
  "resumo": resumo,
  "google": sincronizarGoogle,
};

export async function rodarTarefa(tarefa: Tarefa, disparadoPor = "cron", silenciosoSeVazio = false) {
  // o ciclo em si não vai para o log: cada tarefa que ele dispara já vai
  const registrar = tarefa !== "ciclo" || disparadoPor !== "cron";
  const { data: log } = registrar
    ? await db().from("escala_log_job").insert({ tarefa, disparado_por: disparadoPor }).select("id").single()
    : { data: null };
  try {
    if (tarefa === "google") await aguardarGoogleAnterior(log?.id ?? null);
    const r = await EXECUTORES[tarefa]();
    if (log) {
      if (silenciosoSeVazio && r.itens === 0) await db().from("escala_log_job").delete().eq("id", log.id);
      else await db().from("escala_log_job").update({ fim: new Date().toISOString(), status: "OK", itens: r.itens }).eq("id", log.id);
    }
    return { ok: true as const, tarefa, ...r };
  } catch (e) {
    const erro = (e as Error).message;
    if (log) await db().from("escala_log_job").update({ fim: new Date().toISOString(), status: "ERRO", erro }).eq("id", log.id);
    else await db().from("escala_log_job").insert({ tarefa, disparado_por: disparadoPor, fim: new Date().toISOString(), status: "ERRO", erro });
    return { ok: false as const, tarefa, erro };
  }
}
