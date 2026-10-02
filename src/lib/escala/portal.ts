// Dados do portal do colaborador. Sempre filtrados pelo participante logado;
// de outras pessoas só saem números agregados (ocupação, vagas, tamanho da fila).
import { db } from "@/lib/db";
import { ehFimDeSemana, hojeSP, somarDias, type Grupo } from "./calendario";
import { configDa } from "./servico";
import type { ParticipantePortal } from "./auth";

export interface Ocupacao {
  capacidade: number;
  escalados: number;
  vagasLivres: number;
  vagasDisponiveis: number;
  /** vagas de reserva do dia (livres + já reservadas) — o "de 4" do contador */
  totalReserva: number;
  fila: number;
}

export interface MinhaReserva {
  id: string;
  data: string;
  status: "CONFIRMADA" | "CANCELADA" | "UTILIZADA" | "EXPIRADA";
  origem: "DIRETA" | "FILA";
  motivo: string | null;
}

export interface MinhaFila {
  id: string;
  data: string;
  status: "AGUARDANDO" | "OFERECIDA" | "ATENDIDA" | "EXPIRADA" | "CANCELADA";
  posicao: number | null;
  expiraEm: string | null;
}

export interface DiaPortal {
  data: string;
  grupo: Grupo | null;
  feriado: string | null;
  fimDeSemana: boolean;
  passado: boolean;
  hoje: boolean;
  prazo: string | null;
  prazoPassou: boolean;
  meuDia: boolean;
  ausente: boolean;
  ausenteEmCima: boolean;
  reserva: MinhaReserva | null;
  fila: MinhaFila | null;
  ocupacao: Ocupacao | null;
}

export interface ContextoPortal {
  agora: string;
  hoje: string;
  afastado: boolean;
  limiteMensal: number;
  reservasNoMes: Record<string, number>; // "AAAA-MM" → confirmadas + utilizadas
  ofertaValidadeMin: number;
}

async function ocupacao(unidade: string, data: string, agora: string): Promise<Ocupacao | null> {
  const { data: r } = await db().rpc("escala_ocupacao", { p_unidade: unidade, p_data: data, p_agora: agora });
  const o = (r as Record<string, number>[] | null)?.[0];
  if (!o) return null;
  return {
    capacidade: o.capacidade,
    escalados: o.escalados,
    vagasLivres: o.vagas_livres,
    vagasDisponiveis: o.vagas_disponiveis,
    totalReserva: Math.max(0, o.vagas_livres + o.reservas),
    fila: o.fila_aguardando + o.ofertas_pendentes,
  };
}

export async function posicaoFila(filaId: string): Promise<number | null> {
  const { data } = await db().rpc("escala_posicao_fila", { p_fila: filaId });
  return (data as number | null) ?? null;
}

/** Todos os dias do intervalo, com o que importa para esta pessoa. */
export async function carregarDias(
  p: ParticipantePortal,
  de: string,
  ate: string,
  agora = new Date(),
  comOcupacao = true,
): Promise<DiaPortal[]> {
  const agoraIso = agora.toISOString();
  const hoje = hojeSP(agora);
  const [dias, feriados, reservas, filas, ausencias] = await Promise.all([
    db().from("escala_dia").select("data, grupo, prazo").eq("unidade_id", p.unidadeId).gte("data", de).lte("data", ate),
    db().from("escala_feriado").select("data, nome").or(`unidade_id.is.null,unidade_id.eq.${p.unidadeId}`).gte("data", de).lte("data", ate),
    db().from("escala_reserva").select("id, data, status, origem, motivo_cancelamento, atualizado_em")
      .eq("participante_id", p.id).gte("data", de).lte("data", ate).order("atualizado_em"),
    db().from("escala_fila").select("id, data, status, oferta_expira_em, atualizado_em")
      .eq("participante_id", p.id).gte("data", de).lte("data", ate).order("atualizado_em"),
    db().from("escala_ausencia").select("data, em_cima_da_hora").eq("participante_id", p.id).gte("data", de).lte("data", ate),
  ]);

  const diaMap = new Map((dias.data ?? []).map((d) => [d.data as string, d]));
  const ferMap = new Map((feriados.data ?? []).map((f) => [f.data as string, f.nome as string]));
  // a linha mais recente do dia vence (ativa > cancelada antiga)
  const resMap = new Map<string, MinhaReserva>();
  for (const r of reservas.data ?? []) {
    const atual = resMap.get(r.data);
    if (!atual || r.status === "CONFIRMADA" || r.status === "UTILIZADA" || (atual.status !== "CONFIRMADA" && atual.status !== "UTILIZADA"))
      resMap.set(r.data, { id: r.id, data: r.data, status: r.status, origem: r.origem, motivo: r.motivo_cancelamento });
  }
  const filaMap = new Map<string, MinhaFila>();
  for (const f of filas.data ?? []) {
    const atual = filaMap.get(f.data);
    const ativa = f.status === "AGUARDANDO" || f.status === "OFERECIDA";
    if (!atual || ativa || !(atual.status === "AGUARDANDO" || atual.status === "OFERECIDA"))
      filaMap.set(f.data, { id: f.id, data: f.data, status: f.status, posicao: null, expiraEm: f.oferta_expira_em });
  }
  await Promise.all(
    [...filaMap.values()].filter((f) => f.status === "AGUARDANDO" || f.status === "OFERECIDA")
      .map(async (f) => (f.posicao = await posicaoFila(f.id))),
  );
  const ausMap = new Map((ausencias.data ?? []).map((a) => [a.data as string, a.em_cima_da_hora as boolean]));

  const out: DiaPortal[] = [];
  for (let d = de; d <= ate; d = somarDias(d, 1)) {
    const dia = diaMap.get(d);
    const grupo = (dia?.grupo as Grupo | undefined) ?? null;
    out.push({
      data: d,
      grupo,
      feriado: ferMap.get(d) ?? null,
      fimDeSemana: ehFimDeSemana(d),
      passado: d < hoje,
      hoje: d === hoje,
      prazo: dia?.prazo ?? null,
      prazoPassou: dia ? new Date(dia.prazo) <= agora : true,
      meuDia: grupo === p.grupo,
      ausente: ausMap.has(d),
      ausenteEmCima: ausMap.get(d) ?? false,
      reserva: resMap.get(d) ?? null,
      fila: filaMap.get(d) ?? null,
      ocupacao: null,
    });
  }
  if (comOcupacao)
    await Promise.all(
      out.filter((d) => d.grupo && d.data >= hoje).map(async (d) => (d.ocupacao = await ocupacao(p.unidadeId, d.data, agoraIso))),
    );
  return out;
}

export async function contextoPortal(p: ParticipantePortal, agora = new Date()): Promise<ContextoPortal> {
  const cfg = await configDa(p.unidadeId);
  const hoje = hojeSP(agora);
  const { data } = await db()
    .from("escala_reserva")
    .select("data")
    .eq("participante_id", p.id)
    .in("status", ["CONFIRMADA", "UTILIZADA"])
    .gte("data", somarDias(hoje, -40));
  const porMes: Record<string, number> = {};
  for (const r of data ?? []) porMes[r.data.slice(0, 7)] = (porMes[r.data.slice(0, 7)] ?? 0) + 1;
  const { data: afast } = await db().rpc("escala_afastado", { p_participante: p.id, p_data: hoje });
  return {
    agora: agora.toISOString(),
    hoje,
    afastado: p.statusColaborador === "Afastado" || afast === true,
    limiteMensal: cfg.limite_mensal,
    reservasNoMes: porMes,
    ofertaValidadeMin: cfg.oferta_validade_min,
  };
}
