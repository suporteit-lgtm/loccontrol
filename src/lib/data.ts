import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "./db";
import {
  usuarioAtual,
  unidadeAtual,
  veRH,
  veTI,
  ehAdmin,
  TODAS,
  TODAS_CIDADES,
  type UnidadeFiltro,
} from "./session";
import type { Chamado, Colaborador, FatiaStatus, UnidadesMap, Usuario } from "./types";

/** Mapa cidade → unidades. Deduplicado por request via React cache. */
export const unidadesMap = cache(async (): Promise<UnidadesMap> => {
  const [{ data }, { data: cs }] = await Promise.all([
    db().from("unidades").select("nome, cidades(nome)").order("nome"),
    db().from("cidades").select("nome"),
  ]);
  const map: UnidadesMap = {};
  for (const u of (data ?? []) as unknown as { nome: string; cidades: { nome: string } }[]) {
    const cidade = u.cidades?.nome;
    if (!cidade) continue;
    (map[cidade] ??= []).push(u.nome);
  }
  for (const c of cs ?? []) map[c.nome] ??= [];
  for (const k of Object.keys(map)) map[k].sort((a, b) => a.localeCompare(b));
  return map;
});

/** Mapa filtrado pelas unidades que o usuário pode acessar (vazio = todas). */
export function mapaPermitido(usuario: Usuario, mapa: UnidadesMap): UnidadesMap {
  const lista = usuario.unidades_acesso ?? [];
  if (!lista.length || usuario.papel === "Superadmin") return mapa;
  const out: UnidadesMap = {};
  for (const chave of lista) {
    const [cidade, unidade] = chave.split("|");
    if (mapa[cidade]?.includes(unidade)) (out[cidade] ??= []).push(unidade);
  }
  for (const k of Object.keys(out)) out[k].sort((a, b) => a.localeCompare(b));
  // se as unidades atribuídas foram removidas do sistema, evita o bloqueio total
  return Object.keys(out).length ? out : mapa;
}

/** Usuário restrito não tem a opção "Todas as unidades" (evita ver a cidade inteira). */
export function ehRestrito(usuario: Usuario): boolean {
  return usuario.papel !== "Superadmin" && (usuario.unidades_acesso ?? []).length > 0;
}

/** Valida o cookie de unidade contra o que o usuário pode ver. */
export async function filtroPermitido(usuario: Usuario, mapa: UnidadesMap): Promise<UnidadeFiltro> {
  const bruto = await unidadeAtual();
  const permitido = mapaPermitido(usuario, mapa);
  const cidades = Object.keys(permitido).sort((a, b) => a.localeCompare(b));
  if (!cidades.length) return bruto;
  let { cidade, unidade } = bruto;
  // "Todas as cidades" é válido para quem não tem restrição de unidades
  if (cidade === TODAS_CIDADES) {
    return ehRestrito(usuario) ? { cidade: cidades[0], unidade: permitido[cidades[0]][0] ?? TODAS } : bruto;
  }
  if (!permitido[cidade]) {
    cidade = cidades[0];
    unidade = TODAS;
  }
  const restrito = ehRestrito(usuario);
  if (unidade === TODAS && restrito) unidade = permitido[cidade][0] ?? TODAS;
  if (unidade !== TODAS && !permitido[cidade].includes(unidade))
    unidade = restrito ? permitido[cidade][0] ?? TODAS : TODAS;
  return { cidade, unidade };
}

export interface Contexto {
  usuario: Usuario;
  filtro: UnidadeFiltro;
}

/** Sessão obrigatória + guarda de acesso por área da tela. */
export async function contexto(area?: "rh" | "ti" | "geral"): Promise<Contexto> {
  const usuario = await usuarioAtual();
  if (!usuario) redirect("/login");
  if (area === "rh" && !veRH(usuario.papel)) redirect(usuario.papel.includes("T.I") ? "/dash-ti" : "/login");
  if (area === "ti" && !veTI(usuario.papel)) redirect("/dash");
  const filtro = await filtroPermitido(usuario, await unidadesMap());
  return { usuario, filtro };
}

export function daUnidade(c: Pick<Colaborador, "cidade" | "unidade">, f: UnidadeFiltro): boolean {
  if (f.cidade === TODAS_CIDADES) return true;
  return c.cidade === f.cidade && (f.unidade === TODAS || c.unidade === f.unidade);
}

export async function colaboradoresDaUnidade(f: UnidadeFiltro): Promise<Colaborador[]> {
  let q = db().from("colaboradores").select("*").order("nome");
  if (f.cidade !== TODAS_CIDADES) {
    q = q.eq("cidade", f.cidade);
    if (f.unidade !== TODAS) q = q.eq("unidade", f.unidade);
  }
  const { data } = await q;
  return (data ?? []) as Colaborador[];
}

/** Quantas contas ainda não foram lotadas em nenhuma unidade (só a contagem). */
export async function contarSemUnidade(): Promise<number> {
  const { count } = await db()
    .from("colaboradores")
    .select("id", { count: "exact", head: true })
    .is("unidade", null);
  return count ?? 0;
}

/**
 * Contas que ainda não foram lotadas em nenhuma unidade — em geral vindas do
 * Google Workspace. Ficam atrás do filtro "Sem unidade" na tela de
 * Colaboradores; se aparecessem sempre, mascarariam o filtro de unidade.
 */
export async function colaboradoresSemUnidade(): Promise<Colaborador[]> {
  const { data } = await db().from("colaboradores").select("*").is("unidade", null).order("nome");
  return (data ?? []) as Colaborador[];
}

export async function todosColaboradores(): Promise<Colaborador[]> {
  const { data } = await db().from("colaboradores").select("*").order("nome");
  return (data ?? []) as Colaborador[];
}

export async function colaborador(id: string): Promise<Colaborador | null> {
  const { data } = await db().from("colaboradores").select("*").eq("id", id).maybeSingle();
  return (data as Colaborador) ?? null;
}

export async function chamadosAbertos(): Promise<Chamado[]> {
  // concluídos ficam no banco como histórico — as filas só veem os abertos
  const { data } = await db().from("chamados").select("*").is("concluido_em", null).order("criado_em");
  return (data ?? []) as Chamado[];
}

/** Abertos + histórico — usado só para estatísticas (distribuição por status). */
export async function todosChamados(): Promise<Chamado[]> {
  const { data } = await db().from("chamados").select("*").order("criado_em");
  return (data ?? []) as Chamado[];
}

/** Agrupa os chamados nos 4 status que o LOCCONTROL de fato acompanha —
 *  não existe um pipeline "Em Progresso" separado aqui, só aberto/pausado
 *  (silenciado) e, uma vez concluído, resolvido ou fechado sem sucesso. */
export function distribuicaoChamados(chamados: Chamado[]): { dados: FatiaStatus[]; total: number } {
  let aberto = 0, pausado = 0, resolvido = 0, fechado = 0;
  for (const c of chamados) {
    if (!c.concluido_em) {
      if (c.silenciado) pausado++;
      else aberto++;
    } else if (c.resultado === "concluido") {
      resolvido++;
    } else {
      fechado++; // cancelado | negado
    }
  }
  return {
    dados: [
      { st: "Aberto", n: aberto, cor: "var(--color-accent)" },
      { st: "Pausado", n: pausado, cor: "#8a6fa6" },
      { st: "Resolvido", n: resolvido, cor: "var(--ok)" },
      { st: "Fechado", n: fechado, cor: "var(--color-neutral-400)" },
    ],
    total: chamados.length,
  };
}

/** Conclusão vira arquivamento: a linha permanece para o histórico. */
export async function arquivarChamado(id: string, resultado: "concluido" | "cancelado" | "negado", por: string) {
  await db()
    .from("chamados")
    .update({ concluido_em: new Date().toISOString(), resultado, concluido_por: por })
    .eq("id", id);
}

/** Coluna do kanban derivada do SLA (o protótipo mantinha colunas fixas;
 *  aqui a urgência é calculada — silenciado tem prioridade). */
export function colunaDoChamado(ch: Chamado, agoraMs?: number): "hoje" | "h48" | "aguardando" | "pre" {
  if (ch.silenciado) return "pre";
  if (!ch.sla_alvo) return "aguardando";
  const restante = new Date(ch.sla_alvo).getTime() - (agoraMs ?? Date.now());
  if (restante < 24 * 3600e3) return "hoje";
  if (restante < 48 * 3600e3) return "h48";
  return "aguardando";
}

/** Próximo id de chamado CH-NNNN (sequence do banco). */
export async function proximoChamadoId(): Promise<string> {
  const { data, error } = await db().rpc("proximo_chamado");
  if (error || !data) {
    // fallback: maior id + 1
    const { data: rows } = await db().from("chamados").select("id");
    const max = (rows ?? [])
      .map((r) => parseInt(String(r.id).replace("CH-", ""), 10))
      .filter((n) => !isNaN(n))
      .reduce((a, b) => Math.max(a, b), 4840);
    return `CH-${max + 1}`;
  }
  return `CH-${data}`;
}

export { veRH, veTI, ehAdmin, TODAS };
