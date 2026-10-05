"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { exigirRH } from "@/lib/perms";
import { auditar } from "@/lib/audit";
import { escalaHabilitada } from "@/lib/escala/auth";
import { processarAcoes, type Acao } from "@/lib/escala/acoes";
import { ehTarefa, rematerializarComAvisos, rodarTarefa } from "@/lib/escala/jobs";
import { avisarTrocaDeGrupo } from "@/lib/escala/avisos";
import { aposMudancaNaAgenda } from "@/lib/escala/gatilhos";
import { unidadeDaEscala } from "@/lib/escala/rh";
import type { Modo } from "@/lib/escala/envio";

type Res = { ok: boolean; msg: string };
const ESCALA = "Escala BH · Centro";

async function rh() {
  if (!escalaHabilitada()) throw new Error("Módulo Escala de Presença desligado.");
  return exigirRH();
}

function atualizar() {
  revalidatePath("/escala-rh", "layout");
  revalidatePath("/escala", "layout");
  aposMudancaNaAgenda();
}

async function rpc(nome: string, args: Record<string, unknown>) {
  const { data, error } = await db().rpc(nome, args);
  if (error) throw new Error(error.message);
  return data as { ok: boolean; codigo: string; acoes?: Acao[]; canceladas?: Acao[]; [k: string]: unknown };
}

/** Recalcula a escala e trata o que ficou inválido (e-mails respeitam o modo de envio). */
async function rematerializar(motivo: string) {
  const { config } = await unidadeDaEscala();
  try {
    await rematerializarComAvisos(config.unidade_id, motivo);
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

// ── Participantes ────────────────────────────────────────────────────────────
export async function adicionarParticipantes(colaboradorIds: string[], letra: "A" | "B"): Promise<Res> {
  const u = await rh();
  if (!colaboradorIds.length) return { ok: false, msg: "Selecione ao menos um colaborador." };
  const { grupos } = await unidadeDaEscala();
  const grupo = grupos.find((g) => g.letra === letra);
  if (!grupo) return { ok: false, msg: "Grupo não encontrado." };

  const { data: colabs } = await db().from("colaboradores").select("id, nome, status").in("id", colaboradorIds);
  const validos = (colabs ?? []).filter((c) => c.status !== "Desligado");
  if (!validos.length) return { ok: false, msg: "Nenhum colaborador elegível (desligados não entram na escala)." };

  const { error } = await db()
    .from("escala_participante")
    .upsert(
      validos.map((c) => ({ colaborador_id: c.id, grupo_id: grupo.id, ativo: true, atualizado_em: new Date().toISOString() })),
      { onConflict: "colaborador_id" },
    );
  if (error) return { ok: false, msg: error.message };
  for (const c of validos)
    await auditar({ pessoa: c.nome, ator: u.nome, tabela: "escala_participante", campo: "grupo", antes: "—", depois: `Grupo ${letra}` });
  atualizar();
  return { ok: true, msg: `${validos.length} pessoa(s) incluída(s) no Grupo ${letra}.` };
}

export async function moverParticipante(participanteId: string, letra: "A" | "B"): Promise<Res> {
  const u = await rh();
  const { data: p } = await db()
    .from("escala_participante")
    .select("colaboradores(nome), escala_grupo(letra)")
    .eq("id", participanteId)
    .single();
  const antes = (p?.escala_grupo as unknown as { letra: string })?.letra;
  if (antes === letra) return { ok: true, msg: "A pessoa já está nesse grupo." };
  const r = await rpc("escala_mudar_grupo", { p_participante: participanteId, p_letra: letra });
  if (!r.ok) return { ok: false, msg: r.codigo };
  await processarAcoes([...(r.canceladas ?? []), ...(r.acoes ?? [])]);
  await avisarTrocaDeGrupo(participanteId, letra);
  const nome = (p?.colaboradores as unknown as { nome: string })?.nome ?? "—";
  await auditar({ pessoa: nome, ator: u.nome, tabela: "escala_participante", campo: "grupo", antes: `Grupo ${antes}`, depois: `Grupo ${letra}` });
  atualizar();
  const n = r.canceladas?.length ?? 0;
  return { ok: true, msg: `${nome.split(" ")[0]} agora é do Grupo ${letra}.${n ? ` ${n} reserva(s) em dias do novo grupo foram canceladas.` : ""}` };
}

export async function removerParticipante(participanteId: string): Promise<Res> {
  const u = await rh();
  const { data: p } = await db()
    .from("escala_participante")
    .select("colaboradores(nome), escala_grupo(unidade_id)")
    .eq("id", participanteId)
    .single();
  if (!p) return { ok: false, msg: "Participante não encontrado." };
  await db().from("escala_participante").update({ ativo: false, atualizado_em: new Date().toISOString() }).eq("id", participanteId);
  const { data: canceladas } = await db().rpc("escala__cancelar_futuro", {
    p_participante: participanteId,
    p_motivo: "admin",
    p_agora: new Date().toISOString(),
  });
  const unidade = (p.escala_grupo as unknown as { unidade_id: string }).unidade_id;
  const { data: acoes } = await db().rpc("escala__processar_futuro", { p_unidade: unidade, p_agora: new Date().toISOString() });
  await processarAcoes([...((canceladas as Acao[]) ?? []), ...((acoes as Acao[]) ?? [])]);
  const nome = (p.colaboradores as unknown as { nome: string }).nome;
  await auditar({ pessoa: nome, ator: u.nome, tabela: "escala_participante", campo: "ativo", antes: "sim", depois: "não (removido da escala)" });
  atualizar();
  return { ok: true, msg: `${nome.split(" ")[0]} saiu da escala.` };
}

// ── Feriados ─────────────────────────────────────────────────────────────────
export async function adicionarFeriado(data: string, nome: string, semExpediente: boolean): Promise<Res> {
  const u = await rh();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !nome.trim()) return { ok: false, msg: "Informe a data e o nome." };
  const { config } = await unidadeDaEscala();
  const { error } = await db().from("escala_feriado").insert({
    data,
    nome: nome.trim(),
    unidade_id: config.unidade_id,
    origem: "MANUAL",
    sem_expediente: semExpediente,
    criado_por: u.nome,
  });
  if (error) return { ok: false, msg: error.code === "23505" ? "Já existe um feriado nesta data." : error.message };
  await auditar({ pessoa: ESCALA, ator: u.nome, tabela: "escala_feriado", campo: semExpediente ? "sem expediente" : "feriado", antes: "—", depois: `${data} · ${nome.trim()}` });
  const erro = await rematerializar("feriado");
  atualizar();
  return erro ? { ok: false, msg: `Feriado salvo, mas o recálculo falhou: ${erro}` } : { ok: true, msg: "Feriado cadastrado e escala recalculada." };
}

export async function removerFeriado(id: string): Promise<Res> {
  const u = await rh();
  const { data: f } = await db().from("escala_feriado").select("data, nome, origem").eq("id", id).single();
  if (!f) return { ok: false, msg: "Feriado não encontrado." };
  if (f.origem !== "MANUAL") return { ok: false, msg: "Feriados nacionais vêm da BrasilAPI e não são removidos aqui." };
  await db().from("escala_feriado").delete().eq("id", id);
  await auditar({ pessoa: ESCALA, ator: u.nome, tabela: "escala_feriado", campo: "feriado", antes: `${f.data} · ${f.nome}`, depois: "removido" });
  const erro = await rematerializar("feriado");
  atualizar();
  return erro ? { ok: false, msg: `Removido, mas o recálculo falhou: ${erro}` } : { ok: true, msg: "Feriado removido e escala recalculada." };
}

export async function atualizarFeriadosNacionais(): Promise<Res> {
  const u = await rh();
  const r = await rodarTarefa("feriados", u.nome);
  atualizar();
  return r.ok ? { ok: true, msg: `Feriados atualizados (${r.itens} novo(s)).` } : { ok: false, msg: r.erro };
}

// ── Configurações ────────────────────────────────────────────────────────────
export interface ParametrosForm {
  habilitado: boolean;
  capacidade: number;
  data_ancora: string | null;
  grupo_inicial: "A" | "B";
  limite_mensal: number | null;
  prazo_hora: string;
  oferta_validade_min: number;
  lembrete_hora: string;
  resumo_dia_semana: number;
  resumo_hora: string;
}

export async function salvarParametros(p: ParametrosForm): Promise<Res> {
  const u = await rh();
  if (!(p.capacidade > 0)) return { ok: false, msg: "Capacidade deve ser maior que zero." };
  if (p.limite_mensal !== null && p.limite_mensal < 0) return { ok: false, msg: "Limite inválido." };
  if (!(p.oferta_validade_min > 0)) return { ok: false, msg: "Validade da oferta deve ser maior que zero." };
  const { config } = await unidadeDaEscala();
  const { error } = await db()
    .from("escala_config")
    .update({ ...p, atualizado_em: new Date().toISOString() })
    .eq("unidade_id", config.unidade_id);
  if (error) return { ok: false, msg: error.message };

  const antes = config as unknown as Record<string, unknown>;
  for (const [k, v] of Object.entries(p)) {
    const a = antes[k] === null || antes[k] === undefined ? "—" : String(antes[k]).replace(/:00$/, "");
    const d = v === null ? "—" : String(v);
    if (a !== d) await auditar({ pessoa: ESCALA, ator: u.nome, tabela: "escala_config", campo: k, antes: a, depois: d });
  }
  let aviso = "";
  if (p.data_ancora !== config.data_ancora || p.grupo_inicial !== config.grupo_inicial || p.prazo_hora !== config.prazo_hora.slice(0, 5)) {
    const erro = await rematerializar("grupo");
    aviso = erro ? ` Recálculo falhou: ${erro}` : " Escala recalculada.";
  }
  atualizar();
  return { ok: true, msg: `Parâmetros salvos.${aviso}` };
}

export async function salvarModos(modoEnvio: Modo, modoGoogle: Modo, allowlist: string[]): Promise<Res> {
  const u = await rh();
  const { data: atual } = await db().from("escala_global").select("*").single();
  // PRODUÇÃO: só o Superadmin liga (envio real para todo mundo / grupos reais)
  const ligandoProducao =
    (modoEnvio === "PRODUCAO" && atual?.modo_envio !== "PRODUCAO") || (modoGoogle === "PRODUCAO" && atual?.modo_google !== "PRODUCAO");
  if (ligandoProducao && u.papel !== "Superadmin")
    return { ok: false, msg: "Só o Superadmin pode ativar o modo PRODUÇÃO." };
  const lista = [...new Set(allowlist.map((e) => e.trim().toLowerCase()).filter((e) => /.+@.+\..+/.test(e)))];
  const { error } = await db()
    .from("escala_global")
    .update({ modo_envio: modoEnvio, modo_google: modoGoogle, allowlist: lista, atualizado_em: new Date().toISOString(), atualizado_por: u.nome })
    .eq("id", true);
  if (error) return { ok: false, msg: error.message };
  if (atual?.modo_envio !== modoEnvio)
    await auditar({ pessoa: ESCALA, ator: u.nome, tabela: "escala_global", campo: "modo_envio", antes: atual?.modo_envio, depois: modoEnvio });
  if (atual?.modo_google !== modoGoogle)
    await auditar({ pessoa: ESCALA, ator: u.nome, tabela: "escala_global", campo: "modo_google", antes: atual?.modo_google, depois: modoGoogle });
  if ((atual?.allowlist ?? []).join(",") !== lista.join(","))
    await auditar({ pessoa: ESCALA, ator: u.nome, tabela: "escala_global", campo: "allowlist", antes: (atual?.allowlist ?? []).join(", "), depois: lista.join(", ") });
  atualizar();
  return { ok: true, msg: "Modos salvos." };
}

export async function rodarAgora(tarefa: string): Promise<Res> {
  const u = await rh();
  if (!ehTarefa(tarefa)) return { ok: false, msg: "Tarefa desconhecida." };
  const r = await rodarTarefa(tarefa, u.nome);
  atualizar();
  return r.ok ? { ok: true, msg: `Concluído — ${r.itens} item(ns).` } : { ok: false, msg: r.erro };
}

/** Apaga a escala de teste (dias, reservas, fila, ausências) e recalcula. Só com o módulo desligado na unidade. */
export async function reiniciarEscala(): Promise<Res> {
  const u = await rh();
  if (u.papel !== "Superadmin" && !u.papel.startsWith("Admin")) return { ok: false, msg: "Apenas administradores." };
  const { config } = await unidadeDaEscala();
  if (config.habilitado) return { ok: false, msg: "Desligue a escala da unidade antes de reiniciar." };
  const id = config.unidade_id;
  for (const t of ["escala_fila", "escala_reserva", "escala_ausencia", "escala_dia"])
    await db().from(t).delete().eq("unidade_id", id);
  await auditar({ pessoa: ESCALA, ator: u.nome, tabela: "escala_dia", campo: "reinício", antes: "escala de teste", depois: "apagada e recalculada" });
  const erro = await rematerializar("grupo");
  atualizar();
  return erro ? { ok: false, msg: erro } : { ok: true, msg: "Escala reiniciada a partir da data âncora." };
}

// ── Calendário do RH ─────────────────────────────────────────────────────────
export interface PessoaDia {
  participanteId: string;
  nome: string;
  grupo: "A" | "B";
  situacao: "presente" | "ausente" | "ausente_em_cima" | "afastado";
}

export interface DetalheDia {
  data: string;
  grupo: "A" | "B" | null;
  escalados: PessoaDia[];
  reservas: { id: string; participanteId: string; nome: string; grupo: "A" | "B"; status: string; origem: string }[];
  fila: { id: string; nome: string; status: string; expira: string | null }[];
}

export async function detalheDia(data: string): Promise<DetalheDia> {
  await rh();
  const { config } = await unidadeDaEscala();
  const unidade = config.unidade_id;
  const [{ data: dia }, { data: parts }, { data: aus }, { data: res }, { data: fila }] = await Promise.all([
    db().from("escala_dia").select("grupo, congelado, escalados").eq("unidade_id", unidade).eq("data", data).maybeSingle(),
    db().from("escala_participante").select("id, ativo, colaboradores(nome), escala_grupo!inner(letra, unidade_id)").eq("escala_grupo.unidade_id", unidade),
    db().from("escala_ausencia").select("participante_id, em_cima_da_hora").eq("unidade_id", unidade).eq("data", data),
    db().from("escala_reserva").select("id, participante_id, status, origem").eq("unidade_id", unidade).eq("data", data).in("status", ["CONFIRMADA", "UTILIZADA"]),
    db().from("escala_fila").select("id, participante_id, status, oferta_expira_em, entrou_em").eq("unidade_id", unidade).eq("data", data)
      .in("status", ["AGUARDANDO", "OFERECIDA"]).order("entrou_em"),
  ]);
  const info = new Map(
    (parts ?? []).map((p) => [
      p.id,
      { nome: (p.colaboradores as unknown as { nome: string }).nome, grupo: (p.escala_grupo as unknown as { letra: "A" | "B" }).letra, ativo: p.ativo },
    ]),
  );
  const ausentes = new Map((aus ?? []).map((a) => [a.participante_id, a.em_cima_da_hora as boolean]));
  const grupo = (dia?.grupo as "A" | "B" | null) ?? null;
  // dia congelado usa a foto de quem era do grupo; senão, quem é do grupo agora
  const ids: string[] = dia?.congelado
    ? (dia.escalados ?? [])
    : grupo
      ? [...info.entries()].filter(([, v]) => v.ativo && v.grupo === grupo).map(([id]) => id)
      : [];
  const afastados = new Set<string>();
  await Promise.all(
    ids.map(async (id) => {
      const { data: af } = await db().rpc("escala_afastado", { p_participante: id, p_data: data });
      if (af) afastados.add(id);
    }),
  );
  const escalados: PessoaDia[] = ids
    .map((id) => ({
      participanteId: id,
      nome: info.get(id)?.nome ?? "—",
      grupo: info.get(id)?.grupo ?? (grupo as "A" | "B"),
      situacao: (afastados.has(id) ? "afastado" : ausentes.has(id) ? (ausentes.get(id) ? "ausente_em_cima" : "ausente") : "presente") as PessoaDia["situacao"],
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome));
  return {
    data,
    grupo,
    escalados,
    reservas: (res ?? []).map((r) => ({
      id: r.id,
      participanteId: r.participante_id,
      nome: info.get(r.participante_id)?.nome ?? "—",
      grupo: info.get(r.participante_id)?.grupo ?? "A",
      status: r.status,
      origem: r.origem,
    })),
    fila: (fila ?? []).map((f) => ({ id: f.id, nome: info.get(f.participante_id)?.nome ?? "—", status: f.status, expira: f.oferta_expira_em })),
  };
}

export async function registrarAusenciaRH(participanteId: string, data: string): Promise<Res> {
  const u = await rh();
  const r = await rpc("escala_marcar_ausencia", { p_participante: participanteId, p_data: data, p_registrado_por: u.nome });
  if (!r.ok) return { ok: false, msg: r.codigo === "DIA_PASSADO" ? "Dia já passou." : `Não foi possível: ${r.codigo}` };
  await processarAcoes(r.acoes);
  const { data: p } = await db().from("escala_participante").select("colaboradores(nome)").eq("id", participanteId).single();
  await auditar({
    pessoa: (p?.colaboradores as unknown as { nome: string })?.nome,
    ator: u.nome,
    tabela: "escala_ausencia",
    campo: "ausência",
    antes: "—",
    depois: `${data}${r.em_cima_da_hora ? " (em cima da hora)" : ""}`,
  });
  atualizar();
  return { ok: true, msg: "Ausência registrada; o lugar foi liberado." };
}

export async function cancelarReservaRH(reservaId: string): Promise<Res> {
  const u = await rh();
  const { data: rv } = await db()
    .from("escala_reserva")
    .select("data, participante_id, escala_participante(colaboradores(nome))")
    .eq("id", reservaId)
    .single();
  if (!rv) return { ok: false, msg: "Reserva não encontrada." };
  const r = await rpc("escala_cancelar_reserva", { p_reserva: reservaId, p_participante: null, p_motivo: "admin" });
  if (!r.ok) return { ok: false, msg: `Não foi possível: ${r.codigo}` };
  // avisa a pessoa (o RH cancelou) e repassa a vaga para a fila
  await processarAcoes([
    { tipo: "RESERVA_CANCELADA", id: reservaId, data: rv.data, motivo: "admin", participante_id: rv.participante_id },
    ...(r.acoes ?? []),
  ]);
  const nome = (rv.escala_participante as unknown as { colaboradores: { nome: string } })?.colaboradores?.nome;
  await auditar({ pessoa: nome, ator: u.nome, tabela: "escala_reserva", campo: "status", antes: `CONFIRMADA (${rv?.data})`, depois: "CANCELADA pelo RH" });
  atualizar();
  return { ok: true, msg: "Reserva cancelada." };
}

// ── Google (ambiente de teste e agenda de produção) ─────────────────────────
/** Cria a agenda de teste e os grupos de teste (escala-teste-a@/b@). Não toca em nada real. */
export async function prepararAmbienteTesteRH(): Promise<Res> {
  const u = await rh();
  if (u.papel !== "Superadmin" && !u.papel.startsWith("Admin")) return { ok: false, msg: "Apenas administradores." };
  try {
    const { prepararAmbienteTeste } = await import("@/lib/escala/google");
    const feito = await prepararAmbienteTeste();
    await auditar({ pessoa: ESCALA, ator: u.nome, tabela: "escala_global", campo: "ambiente de teste Google", antes: "—", depois: feito.join("; ") || "já existia" });
    atualizar();
    return { ok: true, msg: `Ambiente de teste pronto: ${feito.join(", ") || "já existia"}.` };
  } catch (e) {
    const { msgErroGoogle } = await import("@/services/googleAgenda");
    return { ok: false, msg: msgErroGoogle(e) };
  }
}

/** Cria a agenda "Escala de Presença — BH" usada no modo PRODUÇÃO. Só o Superadmin. */
export async function criarAgendaProducaoRH(): Promise<Res> {
  const u = await rh();
  if (u.papel !== "Superadmin") return { ok: false, msg: "Só o Superadmin cria a agenda de produção." };
  const { config } = await unidadeDaEscala();
  if (config.calendario_id) return { ok: true, msg: "A agenda de produção já existe." };
  try {
    const { criarAgendaProducao } = await import("@/lib/escala/google");
    const id = await criarAgendaProducao(config.unidade_id);
    await auditar({ pessoa: ESCALA, ator: u.nome, tabela: "escala_config", campo: "calendario_id", antes: "—", depois: id });
    atualizar();
    return { ok: true, msg: "Agenda de produção criada (sem eventos até o modo Produção ser ligado)." };
  } catch (e) {
    const { msgErroGoogle } = await import("@/services/googleAgenda");
    return { ok: false, msg: msgErroGoogle(e) };
  }
}
