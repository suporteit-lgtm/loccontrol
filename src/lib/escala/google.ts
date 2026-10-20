// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  Escala ↔ Google (Agenda + Grupos do Workspace)                           ║
// ║                                                                          ║
// ║  Modo (escala_global.modo_google):                                        ║
// ║   DESLIGADO: nada é chamado no Google.                                    ║
// ║   TESTE: agenda de teste (calendario_teste_id) e grupos de teste          ║
// ║          (escala_grupo.email_teste); só e-mails da allowlist entram como  ║
// ║          convidados ou membros. Os grupos reais NUNCA são tocados.        ║
// ║   PRODUÇÃO: agenda da unidade (escala_config.calendario_id) e grupos      ║
// ║          reais (escala_grupo.email_workspace).                            ║
// ║                                                                          ║
// ║  Abordagem ativa: UM evento de dia inteiro por dia na agenda              ║
// ║  compartilhada, com o e-mail do grupo do dia como convidado (o Google     ║
// ║  expande o grupo e o evento aparece na agenda de cada membro) + o e-mail  ║
// ║  individual de quem tem reserva. sendUpdates="none" sempre.               ║
// ║  A sincronização é uma RECONCILIAÇÃO: lê os eventos da escala na agenda   ║
// ║  (propriedade privada escalaUnidade) e cria/atualiza/remove só o que      ║
// ║  difere — idempotente, sem duplicar, e limpa dias que viraram feriado.    ║
// ╚══════════════════════════════════════════════════════════════════════════╝
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { adicionarMembro, criarGrupo, listarMembros, removerMembros } from "@/services/googleWorkspace";
import {
  agendaConfigurada, atualizarEvento, criarAgenda, criarEvento, excluirEvento, listarEventos, msgErroGoogle, type EventoEscala,
} from "@/services/googleAgenda";
import { hojeSP, somarDias, type Grupo } from "./calendario";
import { lerModos, type Modos } from "./envio";
import { DIAS_MATERIALIZADOS, configs, type ConfigEscala } from "./servico";

interface Alvo {
  modo: "TESTE" | "PRODUCAO";
  calendarioId: string | null;
  grupos: Record<Grupo, string | null>;
  /** e-mail individual pode entrar (convidado/membro)? */
  permitido: (email: string) => boolean;
}

async function gruposDa(unidadeId: string) {
  const { data } = await db().from("escala_grupo").select("letra, email_workspace, email_teste").eq("unidade_id", unidadeId);
  return (data ?? []) as { letra: Grupo; email_workspace: string | null; email_teste: string | null }[];
}

export async function alvoGoogle(cfg: ConfigEscala, modos: Modos): Promise<Alvo | null> {
  if (modos.modo_google === "DESLIGADO") return null;
  const gs = await gruposDa(cfg.unidade_id);
  const teste = modos.modo_google === "TESTE";
  const email = (l: Grupo) => {
    const g = gs.find((x) => x.letra === l);
    return (teste ? g?.email_teste : g?.email_workspace)?.toLowerCase() ?? null;
  };
  const allow = new Set(modos.allowlist.map((e) => e.toLowerCase()));
  return {
    modo: modos.modo_google,
    calendarioId: teste ? modos.calendario_teste_id : cfg.calendario_id,
    grupos: { A: email("A"), B: email("B") },
    permitido: teste ? (e) => allow.has(e.toLowerCase()) : () => true,
  };
}

// ── Agenda ───────────────────────────────────────────────────────────────────
/** Estado desejado da agenda: um evento por dia que tenha grupo ou agendamento. */
export function eventosDesejados(
  dias: { data: string; grupo: Grupo | null }[],
  reservas: { data: string; email: string | null }[],
  alvo: Pick<Alvo, "grupos" | "permitido">,
  unidadeNome: string,
): EventoEscala[] {
  const porDia = new Map<string, string[]>();
  for (const r of reservas)
    if (r.email && alvo.permitido(r.email)) porDia.set(r.data, [...(porDia.get(r.data) ?? []), r.email.toLowerCase()]);
  const out: EventoEscala[] = [];
  for (const d of dias) {
    const grupoEmail = d.grupo ? alvo.grupos[d.grupo] : null;
    const individuais = [...new Set(porDia.get(d.data) ?? [])].sort();
    if (!grupoEmail && !individuais.length) continue; // dia livre sem ninguém agendado: sem evento
    out.push({
      data: d.data,
      titulo: d.grupo ? `Presencial — Grupo ${d.grupo}` : "Presencial — dia livre (agendamento)",
      descricao: `Escala de Presença · ${unidadeNome}.${d.grupo ? ` Dia do Grupo ${d.grupo}.` : ""}${
        individuais.length ? ` Agendamentos: ${individuais.length}.` : ""
      } Não vai? Avise pelo portal da escala.`,
      convidados: [...(grupoEmail ? [grupoEmail] : []), ...individuais],
    });
  }
  return out;
}

const assinatura = (e: Pick<EventoEscala, "titulo" | "descricao" | "convidados">) =>
  createHash("sha1").update([e.titulo, e.descricao, [...e.convidados].sort().join(",")].join("|")).digest("hex");

export async function sincronizarAgenda(cfg: ConfigEscala, alvo: Alvo, unidadeNome: string) {
  if (!alvo.calendarioId)
    throw new Error(alvo.modo === "TESTE" ? "Agenda de teste ainda não criada (Configurações → Preparar ambiente de teste)." : "Agenda de produção ainda não criada.");
  const de = hojeSP();
  const ate = somarDias(de, DIAS_MATERIALIZADOS);
  const [{ data: dias }, { data: res }] = await Promise.all([
    db().from("escala_dia").select("data, grupo, google_event_id, google_event_teste_id, sync_hash").eq("unidade_id", cfg.unidade_id).gte("data", de).lte("data", ate).order("data"),
    db().from("escala_reserva").select("data, escala_participante(colaboradores(email))")
      .eq("unidade_id", cfg.unidade_id).gte("data", de).lte("data", ate).in("status", ["CONFIRMADA", "UTILIZADA"]),
  ]);
  const reservas = (res ?? []).map((r) => ({
    data: r.data as string,
    email: (r.escala_participante as unknown as { colaboradores: { email: string | null } })?.colaboradores?.email ?? null,
  }));
  const desejados = new Map(eventosDesejados((dias ?? []) as { data: string; grupo: Grupo | null }[], reservas, alvo, unidadeNome).map((e) => [e.data, e]));
  const existentes = await listarEventos(alvo.calendarioId, cfg.unidade_id, de, ate);

  let criados = 0, atualizados = 0, removidos = 0;
  const idPorDia = new Map<string, string | null>();
  const porDia = new Map<string, typeof existentes>();
  for (const e of existentes) porDia.set(e.data, [...(porDia.get(e.data) ?? []), e]);

  for (const [data, lista] of porDia) {
    const quer = desejados.get(data);
    const [manter, ...sobra] = quer ? lista : [];
    for (const e of quer ? sobra : lista) {
      await excluirEvento(alvo.calendarioId, e.id); // dia que deixou de existir ou duplicado
      removidos++;
    }
    if (!quer) idPorDia.set(data, null);
    else if (manter) {
      if (assinatura(manter) !== assinatura(quer)) {
        await atualizarEvento(alvo.calendarioId, cfg.unidade_id, manter.id, quer);
        atualizados++;
      }
      idPorDia.set(data, manter.id);
    }
  }
  for (const [data, quer] of desejados) {
    if (porDia.has(data)) continue;
    idPorDia.set(data, await criarEvento(alvo.calendarioId, cfg.unidade_id, quer));
    criados++;
  }

  // guarda o ID do evento por dia (coluna do modo) e quando sincronizou
  const coluna = alvo.modo === "TESTE" ? "google_event_teste_id" : "google_event_id";
  const agora = new Date().toISOString();
  for (const d of dias ?? []) {
    const quer = desejados.get(d.data);
    const id = idPorDia.get(d.data) ?? null;
    const hash = quer ? assinatura(quer) : null;
    if ((d as Record<string, unknown>)[coluna] === id && d.sync_hash === hash) continue; // nada mudou
    await db().from("escala_dia")
      .update({ [coluna]: id, sync_hash: hash, sincronizado_em: agora })
      .eq("unidade_id", cfg.unidade_id).eq("data", d.data);
  }
  return { criados, atualizados, removidos };
}

// ── Grupos do Workspace ─────────────────────────────────────────────────────
/**
 * Mantém os grupos A/B iguais aos participantes ativos da escala.
 * Nunca remove OWNER/MANAGER. Na PRODUÇÃO só remove quem é (ou foi) participante
 * da escala — membros que o TI colocou à mão no grupo ficam (aparecem no aviso).
 */
export async function sincronizarGrupos(cfg: ConfigEscala, alvo: Alvo) {
  const { data: parts } = await db()
    .from("escala_participante")
    .select("ativo, colaboradores(email, status), escala_grupo!inner(letra, unidade_id)")
    .eq("escala_grupo.unidade_id", cfg.unidade_id);
  const todos = (parts ?? []).map((p) => ({
    ativo: p.ativo && (p.colaboradores as unknown as { status: string }).status !== "Desligado",
    email: ((p.colaboradores as unknown as { email: string | null }).email ?? "").toLowerCase(),
    letra: (p.escala_grupo as unknown as { letra: Grupo }).letra,
  })).filter((p) => p.email);
  const conhecidos = new Set(todos.map((p) => p.email));

  let adicionados = 0, removidos = 0;
  const avisos: string[] = [];
  for (const letra of ["A", "B"] as const) {
    const grupo = alvo.grupos[letra];
    if (!grupo) continue;
    const quer = new Set(todos.filter((p) => p.ativo && p.letra === letra && alvo.permitido(p.email)).map((p) => p.email));
    const atual = await listarMembros(grupo);
    if (!atual.ok) throw new Error(`grupo ${grupo}: ${atual.erro}`);
    const tem = new Set(atual.membros.map((m) => m.email));
    for (const email of quer)
      if (!tem.has(email)) {
        const r = await adicionarMembro(grupo, email);
        if (!r.ok) throw new Error(`grupo ${grupo}: ${r.erro}`);
        adicionados++;
      }
    const sair = atual.membros.filter(
      (m) => m.papel === "MEMBER" && !quer.has(m.email) && (alvo.modo === "TESTE" || conhecidos.has(m.email)),
    );
    if (sair.length) {
      const r = await removerMembros(grupo, sair.map((m) => m.email));
      if (!r.ok) throw new Error(`grupo ${grupo}: ${r.erro}`);
      removidos += sair.length;
    }
    const extras = atual.membros.filter((m) => m.papel === "MEMBER" && !quer.has(m.email) && !conhecidos.has(m.email) && alvo.modo === "PRODUCAO");
    if (extras.length) avisos.push(`${grupo}: ${extras.length} membro(s) fora da escala mantido(s)`);
  }
  return { adicionados, removidos, avisos };
}

/** Tarefa "google": grupos + agenda de todas as unidades. */
export async function sincronizarGoogle() {
  const modos = await lerModos();
  if (modos.modo_google === "DESLIGADO") return { itens: 0, detalhe: "modo DESLIGADO — nada enviado ao Google" };
  if (!agendaConfigurada()) throw new Error("Credencial do Google (service account) não configurada.");
  let itens = 0;
  const detalhe: unknown[] = [];
  for (const cfg of await configs()) {
    if (!cfg.data_ancora) continue;
    const alvo = (await alvoGoogle(cfg, modos))!;
    const { data: u } = await db().from("unidades").select("nome, cidades(nome)").eq("id", cfg.unidade_id).single();
    const nome = u ? `${(u.cidades as unknown as { nome: string }).nome} · ${u.nome}` : "unidade";
    try {
      const g = await sincronizarGrupos(cfg, alvo);
      const a = await sincronizarAgenda(cfg, alvo, nome);
      itens += g.adicionados + g.removidos + a.criados + a.atualizados + a.removidos;
      detalhe.push({ unidade: nome, modo: alvo.modo, ...g, ...a });
    } catch (e) {
      throw new Error(msgErroGoogle(e));
    }
  }
  return { itens, detalhe };
}

/**
 * Prepara o ambiente de TESTE: cria a agenda de teste (se não houver) e os
 * grupos de teste escala-teste-a@/b@. Não toca em nada real.
 */
export async function prepararAmbienteTeste(): Promise<string[]> {
  const feito: string[] = [];
  const modos = await lerModos();
  if (!modos.calendario_teste_id) {
    const id = await criarAgenda("Escala de Presença — BH (TESTE)");
    await db().from("escala_global").update({ calendario_teste_id: id }).eq("id", true);
    feito.push("agenda de teste criada");
  }
  for (const cfg of await configs())
    for (const g of await gruposDa(cfg.unidade_id))
      if (g.email_teste) {
        const r = await criarGrupo(`Escala TESTE — Grupo ${g.letra}`, g.email_teste);
        if (!r.ok) throw new Error(`${g.email_teste}: ${r.erro}`);
        feito.push(`grupo ${g.email_teste} ok`);
      }
  return feito;
}

/** Cria a agenda de PRODUÇÃO "Escala de Presença — BH" (só o Superadmin chama). */
export async function criarAgendaProducao(unidadeId: string): Promise<string> {
  const id = await criarAgenda("Escala de Presença — BH");
  await db().from("escala_config").update({ calendario_id: id }).eq("unidade_id", unidadeId);
  return id;
}
