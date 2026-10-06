"use server";

import { revalidatePath } from "next/cache";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { contaPortal } from "@/lib/escala/auth";
import { MENSAGEM_BLOQUEIO, type MotivoBloqueio } from "@/lib/escala/calendario";
import { avisarReservaDireta, processarAcoes, type Acao } from "@/lib/escala/acoes";
import { baseUrl } from "@/lib/escala/emails";
import { horaSP } from "@/lib/escala/formato";
import { aposMudancaNaAgenda } from "@/lib/escala/gatilhos";

export interface Resultado {
  ok: boolean;
  msg: string;
  extra?: string;
}

const MENSAGENS: Record<string, string> = {
  ...MENSAGEM_BLOQUEIO,
  LOTADO: "Este dia está lotado. Você pode entrar na lista de espera.",
  HA_VAGAS: "Ainda há vagas neste dia — agende direto.",
  PRAZO_ENCERRADO: "O prazo para cancelar já passou.",
  NAO_ESCALADO: "Este não é um dia do seu grupo.",
  JA_AUSENTE: "Você já avisou que não vai neste dia.",
  VAGA_JA_OCUPADA: "Seu lugar já foi passado para outra pessoa — não dá mais para desfazer.",
  OFERTA_EXPIRADA: "Esta oferta expirou e a vaga passou para a próxima pessoa.",
  STATUS_INVALIDO: "Esta ação não está mais disponível.",
  NAO_ENCONTRADA: "Não encontramos este registro.",
  INATIVO: MENSAGEM_BLOQUEIO.INATIVO,
};

const texto = (codigo: string) => MENSAGENS[codigo as MotivoBloqueio] ?? "Não foi possível concluir. Tente de novo.";

async function eu() {
  const conta = await contaPortal();
  const p = conta?.participante;
  if (!p || !p.ativo) throw new Error("Sessão expirada ou você não está em uma escala.");
  return p;
}

async function rpc(nome: string, args: Record<string, unknown>) {
  const { data, error } = await db().rpc(nome, args);
  if (error) throw new Error(error.message);
  return data as { ok: boolean; codigo: string; acoes?: Acao[]; canceladas?: Acao[]; [k: string]: unknown };
}

function atualizar() {
  revalidatePath("/escala", "layout");
  aposMudancaNaAgenda();
}

export async function reservar(data: string): Promise<Resultado> {
  const p = await eu();
  const r = await rpc("escala_reservar", { p_participante: p.id, p_data: data });
  if (!r.ok) return { ok: false, msg: texto(r.codigo), extra: r.codigo };
  await avisarReservaDireta(p.id, r.reserva_id as string, data);
  atualizar();
  return { ok: true, msg: "Agendamento confirmado." };
}

export async function entrarFila(data: string): Promise<Resultado> {
  const p = await eu();
  const r = await rpc("escala_entrar_fila", { p_participante: p.id, p_data: data });
  if (!r.ok) return { ok: false, msg: texto(r.codigo), extra: r.codigo };
  atualizar();
  return { ok: true, msg: `Você entrou na lista de espera — posição ${r.posicao}.` };
}

export async function cancelarReserva(reservaId: string): Promise<Resultado> {
  const p = await eu();
  const r = await rpc("escala_cancelar_reserva", { p_reserva: reservaId, p_participante: p.id, p_motivo: "pessoa" });
  if (!r.ok) return { ok: false, msg: texto(r.codigo) };
  await processarAcoes(r.acoes);
  atualizar();
  return { ok: true, msg: "Agendamento cancelado." };
}

export async function sairFila(filaId: string): Promise<Resultado> {
  const p = await eu();
  const r = await rpc("escala_sair_fila", { p_fila: filaId, p_participante: p.id });
  if (!r.ok) return { ok: false, msg: texto(r.codigo) };
  await processarAcoes(r.acoes);
  atualizar();
  return { ok: true, msg: "Você saiu da lista de espera." };
}

export async function naoVou(data: string): Promise<Resultado> {
  const p = await eu();
  const r = await rpc("escala_marcar_ausencia", { p_participante: p.id, p_data: data, p_registrado_por: "proprio" });
  if (!r.ok) return { ok: false, msg: texto(r.codigo) };
  await processarAcoes(r.acoes);
  atualizar();
  return {
    ok: true,
    msg: r.em_cima_da_hora
      ? "Ausência registrada (em cima da hora). Seu lugar foi liberado."
      : "Ausência registrada. Seu lugar foi liberado para outra pessoa.",
  };
}

export async function desfazerAusencia(data: string): Promise<Resultado> {
  const p = await eu();
  const r = await rpc("escala_desfazer_ausencia", { p_participante: p.id, p_data: data });
  if (!r.ok) return { ok: false, msg: texto(r.codigo) };
  atualizar();
  return { ok: true, msg: "Pronto — você está de volta neste dia." };
}

export async function aceitarOferta(filaId: string): Promise<Resultado> {
  const p = await eu();
  const r = await rpc("escala_aceitar_oferta", { p_fila: filaId, p_participante: p.id });
  await processarAcoes(r.acoes);
  if (!r.ok) return { ok: false, msg: texto(r.codigo) };
  await avisarReservaDireta(p.id, r.reserva_id as string, r.data as string);
  atualizar();
  return { ok: true, msg: "Vaga aceita — agendamento confirmado." };
}

export async function recusarOferta(filaId: string): Promise<Resultado> {
  const p = await eu();
  const r = await rpc("escala_recusar_oferta", { p_fila: filaId, p_participante: p.id });
  if (!r.ok) return { ok: false, msg: texto(r.codigo) };
  await processarAcoes(r.acoes);
  atualizar();
  return { ok: true, msg: "Oferta recusada. A vaga passou para a próxima pessoa." };
}

// ── Link do e-mail (/escala/oferta/[token]): vale sem login, o token é o segredo ──
export async function responderOfertaPorToken(token: string, aceitar: boolean): Promise<Resultado> {
  if (!/^[0-9a-f]{48}$/.test(token)) return { ok: false, msg: texto("NAO_ENCONTRADA") };
  const r = await rpc(aceitar ? "escala_aceitar_oferta" : "escala_recusar_oferta", {
    p_fila: null,
    p_participante: null,
    p_token: token,
  });
  await processarAcoes(r.acoes);
  if (!r.ok) return { ok: false, msg: texto(r.codigo) };
  if (aceitar) await avisarReservaDireta(r.participante_id as string, r.reserva_id as string, r.data as string);
  atualizar();
  return aceitar
    ? { ok: true, msg: "Vaga aceita — seu agendamento está confirmado." }
    : { ok: true, msg: "Oferta recusada. A vaga passou para a próxima pessoa." };
}

/** Dados de uma oferta pelo token (para a página do link). */
export async function ofertaPorToken(token: string) {
  if (!/^[0-9a-f]{48}$/.test(token)) return null;
  const hash = createHash("sha256").update(token).digest("hex");
  const { data } = await db()
    .from("escala_fila")
    .select("data, status, oferta_expira_em, escala_participante(colaboradores(nome))")
    .eq("oferta_token_hash", hash)
    .maybeSingle();
  if (!data) return null;
  const nome = (data.escala_participante as unknown as { colaboradores: { nome: string } }).colaboradores.nome;
  return {
    data: data.data as string,
    status: data.status as string,
    expira: data.oferta_expira_em as string,
    expiraTexto: horaSP(data.oferta_expira_em as string),
    primeiroNome: nome.split(" ")[0],
  };
}

// ── Preferências ─────────────────────────────────────────────────────────────
export async function salvarLembretes(ligado: boolean): Promise<Resultado> {
  const p = await eu();
  const { error } = await db()
    .from("escala_preferencia")
    .upsert({ participante_id: p.id, lembretes: ligado }, { onConflict: "participante_id" });
  if (error) return { ok: false, msg: error.message };
  atualizar();
  return { ok: true, msg: ligado ? "Lembretes por e-mail ligados." : "Lembretes por e-mail desligados." };
}

/** Gera um novo feed ICS (o anterior deixa de funcionar). A URL só é mostrada agora. */
export async function gerarFeedIcs(): Promise<Resultado> {
  const p = await eu();
  const token = randomBytes(24).toString("base64url");
  const hash = createHash("sha256").update(token).digest("hex");
  const { error } = await db()
    .from("escala_preferencia")
    .upsert({ participante_id: p.id, ics_token_hash: hash, ics_criado_em: new Date().toISOString() }, { onConflict: "participante_id" });
  if (error) return { ok: false, msg: error.message };
  atualizar();
  return { ok: true, msg: "Novo link gerado. Copie agora — ele não será mostrado de novo.", extra: `${baseUrl()}/api/escala/ics/${token}` };
}

export async function revogarFeedIcs(): Promise<Resultado> {
  const p = await eu();
  await db().from("escala_preferencia").update({ ics_token_hash: null, ics_criado_em: null }).eq("participante_id", p.id);
  atualizar();
  return { ok: true, msg: "Link do calendário revogado." };
}
