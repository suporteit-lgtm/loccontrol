// Efeitos das funções SQL: cada ação devolvida (vaga atribuída, oferta, cancelamento)
// vira e-mail — sempre pelo `despachar`, que respeita o modo de envio.
import { db } from "@/lib/db";
import { despachar, lerModos, type Modos } from "./envio";
import { emailReservaCancelada, emailVagaConfirmada, emailVagaOferecida } from "./emails";

export interface Acao {
  tipo: string;
  participante_id?: string;
  data?: string;
  reserva_id?: string;
  fila_id?: string;
  id?: string;
  expira_em?: string;
  token?: string;
  motivo?: string;
}

interface Pessoa {
  nome: string;
  email: string | null;
  unidadeId: string;
}

async function pessoas(ids: string[]): Promise<Map<string, Pessoa>> {
  const mapa = new Map<string, Pessoa>();
  if (!ids.length) return mapa;
  const { data } = await db()
    .from("escala_participante")
    .select("id, colaboradores(nome, email), escala_grupo(unidade_id)")
    .in("id", ids);
  for (const p of data ?? []) {
    const c = p.colaboradores as unknown as { nome: string; email: string | null };
    const g = p.escala_grupo as unknown as { unidade_id: string };
    mapa.set(p.id, { nome: c.nome.split(" ")[0], email: c.email, unidadeId: g.unidade_id });
  }
  return mapa;
}

async function prazoDe(unidadeId: string, data: string): Promise<string> {
  const { data: d } = await db().from("escala_dia").select("prazo").eq("unidade_id", unidadeId).eq("data", data).maybeSingle();
  return d?.prazo ?? new Date().toISOString();
}

/** Reação às ações; devolve quantos e-mails foram tratados (enviados ou registrados). */
export async function processarAcoes(acoes: Acao[] | null | undefined, modos?: Modos): Promise<number> {
  const lista = (acoes ?? []).filter((a) => ["ATRIBUIDA", "OFERECIDA", "RESERVA_CANCELADA"].includes(a.tipo));
  if (!lista.length) return 0;
  const md = modos ?? (await lerModos());
  const mapa = await pessoas([...new Set(lista.map((a) => a.participante_id!).filter(Boolean))]);

  let n = 0;
  for (const a of lista) {
    const p = mapa.get(a.participante_id!);
    if (!p?.email || !a.data) continue;
    let msg: { chave: string; tipo: string; assunto: string; html: string; texto: string } | null = null;

    if (a.tipo === "ATRIBUIDA") {
      const t = emailVagaConfirmada(p.nome, a.data, true, await prazoDe(p.unidadeId, a.data));
      msg = { chave: `confirmada:${a.reserva_id}`, tipo: "VAGA_CONFIRMADA", assunto: "Vaga confirmada — Escala de Presença", ...t };
    } else if (a.tipo === "OFERECIDA" && a.token && a.expira_em) {
      const t = emailVagaOferecida(p.nome, a.data, a.expira_em, a.token);
      msg = { chave: `oferta:${a.fila_id}:${a.expira_em}`, tipo: "VAGA_OFERECIDA", assunto: "Abriu uma vaga para você — Escala de Presença", ...t };
    } else if (a.tipo === "RESERVA_CANCELADA") {
      const t = emailReservaCancelada(p.nome, a.data, a.motivo ?? "");
      msg = { chave: `cancelada:${a.id}`, tipo: "RESERVA_CANCELADA", assunto: "Agendamento cancelado — Escala de Presença", ...t };
    }
    if (msg) {
      await despachar({ ...msg, para: p.email }, md);
      n++;
    }
  }
  return n;
}

/** Confirmação de reserva direta (feita pela própria pessoa). */
export async function avisarReservaDireta(participanteId: string, reservaId: string, data: string) {
  const p = (await pessoas([participanteId])).get(participanteId);
  if (!p?.email) return;
  const t = emailVagaConfirmada(p.nome, data, false, await prazoDe(p.unidadeId, data));
  await despachar({ chave: `confirmada:${reservaId}`, para: p.email, tipo: "VAGA_CONFIRMADA", assunto: "Agendamento confirmado — Escala de Presença", ...t });
}
