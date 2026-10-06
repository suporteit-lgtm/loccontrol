// Leituras do Dashboard da Escala (servidor, service_role). Os números saem das
// views escala_v_presenca / escala_v_dia; a agregação final fica em metricas.ts.
import { db } from "@/lib/db";
import { hojeSP, somarDias } from "./calendario";
import {
  abAcumulado, ausenciaPorSemana, cards, demandaReprimida, frequencia, porDia, previsao,
  type LinhaFila, type LinhaPresenca,
} from "./metricas";
import { participantes, unidadeDaEscala } from "./rh";

export interface Filtros {
  de: string;
  ate: string;
  grupo: "" | "A" | "B";
  pessoa: string;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function lerFiltros(sp: Record<string, string | undefined>, hoje = hojeSP()): Filtros {
  const de = ISO.test(sp.de ?? "") ? sp.de! : `${hoje.slice(0, 7)}-01`;
  // padrão: o mês inteiro (dias realizados + previstos); os cards só contam até hoje
  const [a, m] = hoje.split("-").map(Number);
  let ate = ISO.test(sp.ate ?? "") ? sp.ate! : new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
  if (ate < de) ate = de;
  const grupo = sp.grupo === "A" || sp.grupo === "B" ? sp.grupo : "";
  return { de, ate, grupo, pessoa: /^[0-9a-f-]{36}$/.test(sp.pessoa ?? "") ? sp.pessoa! : "" };
}

/** PostgREST devolve no máximo 1000 linhas por chamada: pagina até acabar. */
async function todas<T>(consulta: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const out: T[] = [];
  for (let i = 0; ; i += 1000) {
    const { data, error } = await consulta(i, i + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

export async function carregarDashboard(f: Filtros) {
  const u = await unidadeDaEscala();
  const unidade = u.config.unidade_id;
  const hoje = hojeSP();
  const fimPrev = somarDias(hoje, 30);

  const [pessoasTodas, diasPeriodo, diasAB, linhasBrutas, filaBruta, prev] = await Promise.all([
    participantes(unidade),
    todas<{ data: string; grupo: "A" | "B" | null }>((a, b) =>
      db().from("escala_dia").select("data, grupo").eq("unidade_id", unidade).gte("data", f.de).lte("data", f.ate).order("data").range(a, b)),
    // diferença A×B: desde a âncora até o fim do período
    todas<{ data: string; grupo: "A" | "B" | null }>((a, b) =>
      db().from("escala_dia").select("data, grupo").eq("unidade_id", unidade)
        .gte("data", u.config.data_ancora ?? f.de).lte("data", f.ate).order("data").range(a, b)),
    todas<LinhaPresenca>((a, b) =>
      db().from("escala_v_presenca")
        .select("data, grupo_do_dia, participante_id, grupo_pessoa, tipo, afastado, ausente, ausente_em_cima, presente")
        .eq("unidade_id", unidade).gte("data", f.de).lte("data", f.ate).order("data").range(a, b)),
    todas<LinhaFila>((a, b) =>
      db().from("escala_fila").select("data, participante_id, status, oferta_expira_em")
        .eq("unidade_id", unidade).gte("data", f.de).lte("data", f.ate).range(a, b)),
    db().from("escala_v_dia").select("data, grupo, capacidade, presentes")
      .eq("unidade_id", unidade).gt("data", hoje).lte("data", fimPrev).order("data"),
  ]);

  // filtros de grupo/pessoa valem para as pessoas (não para o dia)
  const pessoas = pessoasTodas.filter((p) => (p.ativo || linhasBrutas.some((l) => l.participante_id === p.id)) &&
    (!f.grupo || p.grupo === f.grupo) && (!f.pessoa || p.id === f.pessoa));
  const ids = new Set(pessoas.map((p) => p.id));
  const linhas = linhasBrutas.filter((l) => ids.has(l.participante_id));
  const fila = filaBruta.filter((l) => ids.has(l.participante_id));

  const dias = porDia(diasPeriodo, linhas, fila, u.config.capacidade, hoje);
  const a = diasAB.filter((d) => d.grupo === "A").length;
  const b = diasAB.filter((d) => d.grupo === "B").length;

  return {
    filtros: f,
    hoje,
    unidades: [{ id: unidade, nome: `${u.cidade} · ${u.unidade}` }],
    capacidade: u.config.capacidade,
    pessoasOpcoes: pessoasTodas.filter((p) => !f.grupo || p.grupo === f.grupo).map((p) => ({ id: p.id, nome: p.nome, grupo: p.grupo })),
    filtrado: !!(f.grupo || f.pessoa),
    dias,
    cards: { ...cards(dias), difAB: Math.abs(a - b), diasA: a, diasB: b },
    ausenciaSemana: ausenciaPorSemana(dias),
    abMensal: abAcumulado(diasAB),
    previsao: previsao((prev.data ?? []).map((d) => ({ data: d.data, grupo: d.grupo, capacidade: Number(d.capacidade), presentes: Number(d.presentes) }))),
    frequencia: frequencia(pessoas.map((p) => ({ id: p.id, nome: p.nome, grupo: p.grupo })), linhas, hoje),
    demanda: demandaReprimida(dias),
  };
}

export type Dashboard = Awaited<ReturnType<typeof carregarDashboard>>;

/** Histórico de uma pessoa (detalhe do colaborador no dashboard). */
export async function detalhePessoa(participanteId: string) {
  const u = await unidadeDaEscala();
  const p = (await participantes(u.config.unidade_id)).find((x) => x.id === participanteId);
  if (!p) return null;
  const [escalas, reservas, fila, afast] = await Promise.all([
    todas<LinhaPresenca>((a, b) =>
      db().from("escala_v_presenca")
        .select("data, grupo_do_dia, participante_id, grupo_pessoa, tipo, afastado, ausente, ausente_em_cima, presente")
        .eq("participante_id", participanteId).eq("tipo", "ESCALADO").lte("data", hojeSP()).order("data", { ascending: false }).range(a, b)),
    db().from("escala_reserva").select("id, data, status, origem, motivo_cancelamento, criado_em")
      .eq("participante_id", participanteId).order("data", { ascending: false }).limit(500),
    db().from("escala_fila").select("id, data, status, entrou_em, oferta_expira_em")
      .eq("participante_id", participanteId).order("data", { ascending: false }).limit(500),
    // LGPD: só as datas do afastamento, nunca o motivo
    db().from("escala_afastamento").select("inicio, fim").eq("participante_id", participanteId).order("inicio", { ascending: false }),
  ]);
  return {
    pessoa: p,
    unidade: `${u.cidade} · ${u.unidade}`,
    resumo: {
      ...frequencia([{ id: p.id, nome: p.nome, grupo: p.grupo }], escalas, hojeSP())[0],
      reservasUsadas: (reservas.data ?? []).filter((r) => r.status === "UTILIZADA").length,
    },
    escalas,
    reservas: reservas.data ?? [],
    fila: fila.data ?? [],
    afastamentos: afast.data ?? [],
  };
}
