// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  Avisos agendados e de mudança da Escala (sempre pelo `despachar`, que    ║
// ║  respeita o modo de envio DESLIGADO / TESTE / PRODUÇÃO).                  ║
// ║   • lembrete da véspera (desligável pela pessoa)                          ║
// ║   • resumo semanal do RH                                                  ║
// ║   • mudança na escala (feriado, remanejamento, troca de grupo)            ║
// ╚══════════════════════════════════════════════════════════════════════════╝
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { diaDaSemana, grupoFixo, hojeSP, somarDias, type Grupo } from "./calendario";
import { carregarDashboard, lerFiltros } from "./dashboard";
import { emailLembrete, emailMudancaEscala, emailResumoRH } from "./emails";
import { despachar, lerModos, type Modos } from "./envio";
import { dataCurta, dataLonga } from "./formato";
import { configs, type ConfigEscala } from "./servico";

interface Membro {
  id: string;
  nome: string;
  email: string | null;
}

async function membrosDoGrupo(unidadeId: string, letra: Grupo): Promise<Membro[]> {
  const { data } = await db()
    .from("escala_participante")
    .select("id, colaboradores(nome, email, status), escala_grupo!inner(letra, unidade_id)")
    .eq("ativo", true)
    .eq("escala_grupo.unidade_id", unidadeId)
    .eq("escala_grupo.letra", letra);
  return (data ?? [])
    .map((p) => ({ p, c: p.colaboradores as unknown as { nome: string; email: string | null; status: string } }))
    .filter(({ c }) => c.status !== "Desligado")
    .map(({ p, c }) => ({ id: p.id, nome: c.nome.split(" ")[0], email: c.email }));
}

// ── Lembrete da véspera ──────────────────────────────────────────────────────
/**
 * Roda no dia útil anterior (a partir de `lembrete_hora`): avisa quem vai no
 * PRÓXIMO dia útil — escalados não afastados e sem ausência + reservas confirmadas.
 * Quem desligou os lembretes nas preferências não recebe.
 */
export async function enviarLembretes(cfg: ConfigEscala, agora = new Date(), modos?: Modos): Promise<number> {
  const hoje = hojeSP(agora);
  const { data: hojeUtil } = await db().from("escala_dia").select("data").eq("unidade_id", cfg.unidade_id).eq("data", hoje).maybeSingle();
  if (!hojeUtil) return 0; // véspera = dia útil anterior; fim de semana e feriado não disparam
  const { data: prox } = await db()
    .from("escala_dia")
    .select("data, grupo")
    .eq("unidade_id", cfg.unidade_id)
    .gt("data", hoje)
    .order("data")
    .limit(1)
    .maybeSingle();
  if (!prox) return 0;

  const { data: vao } = await db()
    .from("escala_v_presenca")
    .select("participante_id, tipo")
    .eq("unidade_id", cfg.unidade_id)
    .eq("data", prox.data)
    .eq("presente", true);
  const ids = [...new Set((vao ?? []).map((v) => v.participante_id as string))];
  if (!ids.length) return 0;

  const [{ data: pessoas }, { data: prefs }] = await Promise.all([
    db().from("escala_participante").select("id, colaboradores(nome, email, status)").in("id", ids),
    db().from("escala_preferencia").select("participante_id, lembretes").in("participante_id", ids),
  ]);
  const semLembrete = new Set((prefs ?? []).filter((p) => !p.lembretes).map((p) => p.participante_id));
  const tipo = new Map((vao ?? []).map((v) => [v.participante_id as string, v.tipo as string]));
  const md = modos ?? (await lerModos());

  let n = 0;
  for (const p of pessoas ?? []) {
    const c = p.colaboradores as unknown as { nome: string; email: string | null; status: string };
    if (!c.email || semLembrete.has(p.id) || c.status === "Afastado") continue;
    const t = emailLembrete(c.nome.split(" ")[0], prox.data, tipo.get(p.id) === "RESERVA" ? "reserva" : "grupo", prox.grupo ?? "");
    await despachar(
      { chave: `lembrete:${p.id}:${prox.data}`, para: c.email, tipo: "LEMBRETE", assunto: `Amanhã é dia de escritório — ${dataCurta(prox.data)}`, ...t },
      md,
    );
    n++;
  }
  return n;
}

// ── Resumo semanal do RH ─────────────────────────────────────────────────────
async function destinatariosRH(): Promise<string[]> {
  const { data } = await db()
    .from("usuarios")
    .select("email")
    .in("papel", ["Superadmin", "Admin RH", "Usuário RH"])
    .eq("status", "aprovado");
  return [...new Set((data ?? []).map((u) => String(u.email).toLowerCase()).filter(Boolean))];
}

/** Números da semana anterior (seg–dom) + alerta de poucas vagas na semana que vem. */
export async function enviarResumoSemanal(agora = new Date(), modos?: Modos): Promise<number> {
  const hoje = hojeSP(agora);
  const segAtual = somarDias(hoje, -((diaDaSemana(hoje) + 6) % 7));
  const de = somarDias(segAtual, -7);
  const ate = somarDias(segAtual, -1);
  const d = await carregarDashboard(lerFiltros({ de, ate }, hoje));
  const c = d.cards;
  const pct = (v: number | null) => (v === null ? "—" : `${v.toLocaleString("pt-BR")}%`);

  const destaques: string[] = [];
  const emCima = d.dias.reduce((s, x) => s + x.emCima, 0);
  if (emCima) destaques.push(`${emCima} ausência(s) avisada(s) em cima da hora.`);
  if (d.demanda.diasSemAtendimento)
    destaques.push(`Em ${d.demanda.diasSemAtendimento} dia(s) houve mais procura que lugares (${d.demanda.pessoasSemVaga} pedido(s) sem vaga).`);
  if (c.difAB > 1) destaques.push(`Atenção: a diferença acumulada entre A e B está em ${c.difAB} dias (o ideal é 0 ou 1).`);
  const apertados = d.previsao.filter((x) => x.poucas && x.data <= somarDias(segAtual, 6));
  if (apertados.length) destaques.push(`Poucas vagas nesta semana: ${apertados.map((x) => `${dataCurta(x.data)} (${x.vagas})`).join(", ")}.`);

  const t = emailResumoRH(
    `${dataCurta(de)} a ${dataCurta(ate)}`,
    [
      { rotulo: "Ocupação média", valor: pct(c.ocupacaoMedia) },
      { rotulo: "Taxa de ausência", valor: pct(c.taxaAusencia) },
      { rotulo: "Reservas usadas", valor: `${c.reservasUsadas} de ${c.vagasOferecidas}` },
      { rotulo: "Dias com fila", valor: String(c.diasComFila) },
    ],
    destaques,
  );
  const md = modos ?? (await lerModos());
  let n = 0;
  for (const para of await destinatariosRH()) {
    await despachar({ chave: `resumo:${de}:${para}`, para, tipo: "RESUMO_RH", assunto: `Resumo semanal da Escala — ${dataCurta(de)} a ${dataCurta(ate)}`, ...t }, md);
    n++;
  }
  return n;
}

// ── Mudança na escala ────────────────────────────────────────────────────────
async function enviarMudancas(porPessoa: Map<string, { m: Membro; linhas: string[] }>, prefixo: string, modos?: Modos) {
  const md = modos ?? (await lerModos());
  let n = 0;
  for (const { m, linhas } of porPessoa.values()) {
    if (!m.email || !linhas.length) continue;
    const hash = createHash("sha1").update(linhas.join("|")).digest("hex").slice(0, 12);
    const t = emailMudancaEscala(m.nome, linhas);
    await despachar({ chave: `mudanca:${prefixo}:${m.id}:${hash}`, para: m.email, tipo: "MUDANCA_ESCALA", assunto: "Sua escala mudou — Escala de Presença", ...t }, md);
    n++;
  }
  return n;
}

/**
 * Depois de uma rematerialização: avisa cada membro do grupo afetado sobre
 * dias fixos que deixaram de existir (feriado) e dias que passaram a ser do
 * grupo (remanejamento para a quarta). Um e-mail por pessoa por mudança.
 */
export async function avisarMudancasDaEscala(
  unidadeId: string,
  r: { removidos?: { data: string }[]; alterados?: string[] },
  modos?: Modos,
): Promise<number> {
  const removidos = (r.removidos ?? []).map((x) => x.data);
  const alterados = r.alterados ?? [];
  if (!removidos.length && !alterados.length) return 0;

  const cfg = (await configs()).find((c) => c.unidade_id === unidadeId);
  if (!cfg?.data_ancora) return 0;
  const params = { ancora: cfg.data_ancora, grupoInicial: cfg.grupo_inicial };
  const [{ data: novos }, { data: feriados }] = await Promise.all([
    db().from("escala_dia").select("data, grupo").eq("unidade_id", unidadeId).in("data", alterados.length ? alterados : ["1900-01-01"]),
    db().from("escala_feriado").select("data, nome").in("data", removidos.length ? removidos : ["1900-01-01"]),
  ]);
  const nomeFeriado = new Map((feriados ?? []).map((f) => [f.data as string, f.nome as string]));

  const eventos: { grupo: Grupo; linha: string }[] = [];
  for (const data of removidos) {
    const g = grupoFixo(data, params);
    if (g) eventos.push({ grupo: g, linha: `${dataLonga(data)} deixou de ser dia útil${nomeFeriado.has(data) ? ` (${nomeFeriado.get(data)})` : ""}.` });
  }
  for (const d of novos ?? [])
    if (d.grupo)
      eventos.push({ grupo: d.grupo as Grupo, linha: `${dataLonga(d.data)} passa a ser dia do Grupo ${d.grupo} (remanejamento por feriado).` });
  if (!eventos.length) return 0;

  const porPessoa = new Map<string, { m: Membro; linhas: string[] }>();
  for (const g of ["A", "B"] as const) {
    const linhas = eventos.filter((e) => e.grupo === g).map((e) => e.linha);
    if (!linhas.length) continue;
    for (const m of await membrosDoGrupo(unidadeId, g)) porPessoa.set(m.id, { m, linhas });
  }
  return enviarMudancas(porPessoa, "escala", modos);
}

/** Troca de grupo feita pelo RH: avisa a pessoa e lista os próximos dias fixos. */
export async function avisarTrocaDeGrupo(participanteId: string, letra: Grupo): Promise<number> {
  const { data: p } = await db()
    .from("escala_participante")
    .select("id, colaboradores(nome, email), escala_grupo(unidade_id)")
    .eq("id", participanteId)
    .single();
  if (!p) return 0;
  const c = p.colaboradores as unknown as { nome: string; email: string | null };
  const unidade = (p.escala_grupo as unknown as { unidade_id: string }).unidade_id;
  const { data: dias } = await db()
    .from("escala_dia")
    .select("data")
    .eq("unidade_id", unidade)
    .eq("grupo", letra)
    .gt("data", hojeSP())
    .order("data")
    .limit(4);
  const linhas = [
    `Você agora faz parte do Grupo ${letra}.`,
    dias?.length ? `Seus próximos dias fixos: ${dias.map((d) => dataCurta(d.data)).join(", ")}.` : "Os próximos dias fixos aparecem no calendário.",
  ];
  const mapa = new Map([[p.id, { m: { id: p.id, nome: c.nome.split(" ")[0], email: c.email }, linhas }]]);
  return enviarMudancas(mapa, `grupo-${letra}`);
}
