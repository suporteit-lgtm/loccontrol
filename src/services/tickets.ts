// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  Sistema de chamados interno — INTEGRAÇÃO REAL                           ║
// ║  API: https://chamados-ti.locgrupo.com.br/api/v1 (produção e homolog     ║
// ║  na mesma URL; o token define o ambiente).                               ║
// ║  Contrato: docs/PROMPT-API-CHAMADOS-CLAUDE.md · entregável da equipe:    ║
// ║  INTEGRACAO-LOCCONTROL.md                                                ║
// ║                                                                          ║
// ║  Sem TICKETS_BASE_URL/TICKETS_TOKEN no ambiente, cai no MOCK (log).      ║
// ║  As falhas aqui NUNCA derrubam a ação principal — o espelhamento é       ║
// ║  melhor-esforço e fica registrado no log do servidor.                    ║
// ╚══════════════════════════════════════════════════════════════════════════╝

export type TipoTicket = "admissao" | "desligamento" | "solicitacao";
export type StatusTicket = "aberto" | "em_andamento" | "pausado" | "concluido" | "cancelado";

export interface NovoTicket {
  ref: string; // CH-NNNN
  tipo: TipoTicket;
  titulo: string;
  descricao: string;
  prazo?: string | null; // ISO
  responsavelEmail?: string | null;
  solicitanteEmail?: string | null;
}

function configurado(): boolean {
  return !!process.env.TICKETS_BASE_URL && !!process.env.TICKETS_TOKEN;
}

async function api(
  caminho: string,
  metodo: "POST" | "PATCH" | "GET",
  corpo?: unknown
): Promise<{ ok: boolean; status: number; dados?: Record<string, unknown> }> {
  const r = await fetch(`${process.env.TICKETS_BASE_URL!.replace(/\/$/, "")}${caminho}`, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${process.env.TICKETS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
    cache: "no-store",
  });
  let dados: Record<string, unknown> | undefined;
  try {
    dados = (await r.json()) as Record<string, unknown>;
  } catch {}
  return { ok: r.ok, status: r.status, dados };
}

/** Abre (ou atualiza, pela idempotência do lado deles) o espelho do chamado. */
export async function abrirTicket(t: NovoTicket): Promise<{ ok: boolean; url?: string }> {
  if (!configurado()) {
    console.log(`[tickets:mock] abriria ${t.ref} — ${t.titulo}`);
    return { ok: true };
  }
  try {
    const r = await api("/tickets", "POST", {
      referencia_externa: t.ref,
      origem: "LOCCONTROL",
      tipo: t.tipo,
      titulo: t.titulo,
      descricao: t.descricao,
      prazo: t.prazo ?? undefined,
      responsavel_email: t.responsavelEmail ?? undefined,
      solicitante_email: t.solicitanteEmail ?? undefined,
    });
    if (!r.ok) {
      console.warn(`[tickets] falha ao abrir ${t.ref}: HTTP ${r.status}`, r.dados);
      return { ok: false };
    }
    return { ok: true, url: (r.dados?.url as string) ?? undefined };
  } catch (e) {
    console.warn(`[tickets] erro de rede ao abrir ${t.ref}:`, (e as Error).message);
    return { ok: false };
  }
}

/** Atualiza o status do espelho (concluir, pausar, reativar, cancelar). */
export async function atualizarTicket(
  ref: string,
  status: StatusTicket,
  comentario?: string
): Promise<{ ok: boolean }> {
  if (!configurado()) {
    console.log(`[tickets:mock] atualizaria ${ref} → ${status}`);
    return { ok: true };
  }
  try {
    const r = await api(`/tickets/${encodeURIComponent(ref)}`, "PATCH", {
      status,
      comentario: comentario ?? undefined,
    });
    // 404 = nunca foi espelhado (ex.: criado antes da integração) — não é erro
    if (!r.ok && r.status !== 404) {
      console.warn(`[tickets] falha ao atualizar ${ref} → ${status}: HTTP ${r.status}`, r.dados);
      return { ok: false };
    }
    return { ok: true };
  } catch (e) {
    console.warn(`[tickets] erro de rede ao atualizar ${ref}:`, (e as Error).message);
    return { ok: false };
  }
}

// ── Compatibilidade com os chamadores existentes ─────────────────────────────

/** @deprecated use abrirTicket — mantido para chamadores antigos. */
export async function notificarAbertura(chamadoId: string, resumo: string): Promise<void> {
  await abrirTicket({
    ref: chamadoId,
    tipo: resumo.toLowerCase().startsWith("deslig") ? "desligamento" : "admissao",
    titulo: resumo,
    descricao: resumo,
  });
}

/** Marca o espelho como concluído. */
export async function notificarConclusao(chamadoId: string, comentario?: string): Promise<void> {
  await atualizarTicket(chamadoId, "concluido", comentario ?? "Concluído pelo LOCCONTROL");
}
