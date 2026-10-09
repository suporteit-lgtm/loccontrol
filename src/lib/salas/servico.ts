// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  Agendamento de Salas — leituras e escritas (servidor, service_role)      ║
// ║  Quem chama já validou a sessão (portal ou LocControl) e diz se a pessoa  ║
// ║  gerencia as salas. A sobreposição é barrada pelo banco (EXCLUDE).        ║
// ╚══════════════════════════════════════════════════════════════════════════╝
import { db } from "@/lib/db";
import { FUSO, hojeSP, instanteSP, somarDias } from "@/lib/escala/calendario";
import { CONFIG_PADRAO, hhmm, minutos, motivoInvalido, type ConfigSalas, type ReservaVista, type Sala } from "./regras";

/** Quem está agindo: a pessoa da reserva (e se gerencia as salas). */
export interface Ator {
  email: string;
  nome: string;
  gestor: boolean;
}

const tabelaAusente = (msg: string) => /sala|relation|schema cache/i.test(msg);

/** Data e hora (São Paulo) de um timestamptz. */
export function partesSP(instante: string | Date): { data: string; hora: string } {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(instante));
  const v = (t: string) => p.find((x) => x.type === t)!.value;
  return { data: `${v("year")}-${v("month")}-${v("day")}`, hora: `${v("hour")}:${v("minute")}` };
}

export function agoraSP(agora = new Date()) {
  const { data, hora } = partesSP(agora);
  return { hoje: data, agoraMin: minutos(hora) };
}

/** Regras atuais. `instalado: false` enquanto a migration 0031 não foi aplicada. */
export async function lerConfig(): Promise<{ config: ConfigSalas; instalado: boolean }> {
  const { data, error } = await db().from("sala_config").select("*").maybeSingle();
  if (error) {
    if (tabelaAusente(error.message)) return { config: CONFIG_PADRAO, instalado: false };
    throw new Error(error.message);
  }
  if (!data) return { config: CONFIG_PADRAO, instalado: true };
  return {
    instalado: true,
    config: {
      hora_inicio: hhmm(minutos(data.hora_inicio)),
      hora_fim: hhmm(minutos(data.hora_fim)),
      intervalo_min: data.intervalo_min,
      dias_antecedencia: data.dias_antecedencia,
      duracao_max_min: data.duracao_max_min,
      fim_de_semana: data.fim_de_semana,
    },
  };
}

export async function listarSalas(incluirInativas = false): Promise<Sala[]> {
  let q = db().from("sala").select("id, nome, descricao, capacidade, local, recursos, ativo, ordem").order("ordem").order("nome");
  if (!incluirInativas) q = q.eq("ativo", true);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as Sala[];
}

interface LinhaReserva {
  id: string;
  sala_id: string;
  inicio: string;
  fim: string;
  titulo: string | null;
  nome: string;
  email: string;
}

function vista(r: LinhaReserva, email: string): ReservaVista {
  const i = partesSP(r.inicio);
  const f = partesSP(r.fim);
  return {
    id: r.id,
    salaId: r.sala_id,
    data: i.data,
    ini: i.hora,
    fim: f.data === i.data ? f.hora : "24:00",
    titulo: r.titulo,
    nome: r.nome,
    email: r.email,
    minha: r.email === email.toLowerCase(),
  };
}

const CAMPOS = "id, sala_id, inicio, fim, titulo, nome, email";

/** Tudo o que a grade de um dia precisa. */
export async function agendaDoDia(data: string, email: string) {
  const [{ config, instalado }, salas] = await Promise.all([lerConfig(), listarSalas().catch(() => [] as Sala[])]);
  const { hoje, agoraMin } = agoraSP();
  if (!instalado) return { instalado, config, salas: [], reservas: [] as ReservaVista[], hoje, agoraMin };
  const { data: linhas, error } = await db()
    .from("sala_reserva")
    .select(CAMPOS)
    .eq("status", "ATIVA")
    .lt("inicio", instanteSP(somarDias(data, 1), "00:00").toISOString())
    .gt("fim", instanteSP(data, "00:00").toISOString())
    .order("inicio");
  if (error) throw new Error(error.message);
  return { instalado, config, salas, reservas: (linhas ?? []).map((r) => vista(r, email)), hoje, agoraMin };
}

/** Próximas reservas de uma pessoa (e as dos últimos `diasAtras` dias). */
export async function reservasDe(email: string, diasAtras = 0) {
  const desde = instanteSP(somarDias(hojeSP(), -diasAtras), "00:00").toISOString();
  const { data, error } = await db()
    .from("sala_reserva")
    .select(`${CAMPOS}, sala(nome, local)`)
    .eq("email", email.toLowerCase())
    .eq("status", "ATIVA")
    .gte("fim", desde)
    .order("inicio")
    .limit(500);
  if (error) {
    if (tabelaAusente(error.message)) return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((r) => {
    const s = r.sala as unknown as { nome: string; local: string | null } | null;
    return { ...vista(r, email), sala: s?.nome ?? "Sala", local: s?.local ?? null, passou: new Date(r.fim) <= new Date() };
  });
}

/** Lista para quem gerencia: período, sala e busca por nome/e-mail. */
export async function buscarReservas(f: { de: string; ate: string; sala: string; pessoa: string }) {
  let q = db()
    .from("sala_reserva")
    .select(`${CAMPOS}, criado_por, criado_em, sala(nome)`)
    .eq("status", "ATIVA")
    .gte("inicio", instanteSP(f.de, "00:00").toISOString())
    .lt("inicio", instanteSP(somarDias(f.ate, 1), "00:00").toISOString())
    .order("inicio")
    .limit(1000);
  if (f.sala) q = q.eq("sala_id", f.sala);
  const termo = f.pessoa.trim().replace(/[%,()]/g, "");
  if (termo) q = q.or(`nome.ilike.%${termo}%,email.ilike.%${termo}%,titulo.ilike.%${termo}%`);
  const { data, error } = await q;
  if (error) {
    if (tabelaAusente(error.message)) return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((r) => ({
    ...vista(r, ""),
    sala: (r.sala as unknown as { nome: string } | null)?.nome ?? "Sala",
    criadoPor: r.criado_por as string,
  }));
}

/** Nome de quem tem este e-mail (cadastro de colaboradores ou usuários). */
async function nomeDoEmail(email: string): Promise<string | null> {
  const [{ data: c }, { data: u }] = await Promise.all([
    db().from("colaboradores").select("nome").eq("email", email).maybeSingle(),
    db().from("usuarios").select("nome").eq("email", email).maybeSingle(),
  ]);
  return (c?.nome as string | undefined) ?? (u?.nome as string | undefined) ?? null;
}

export type Resultado = { ok: true } | { ok: false; erro: string };

export async function criarReserva(
  ator: Ator,
  p: { salaId: string; data: string; ini: string; fim: string; titulo?: string; paraEmail?: string },
): Promise<Resultado> {
  const { config } = await lerConfig();
  const { hoje, agoraMin } = agoraSP();
  const motivo = motivoInvalido({ data: p.data, ini: p.ini, fim: p.fim, config, hoje, agoraMin, gestor: ator.gestor });
  if (motivo) return { ok: false, erro: motivo };

  const { data: sala } = await db().from("sala").select("id, nome, ativo").eq("id", p.salaId).maybeSingle();
  if (!sala?.ativo) return { ok: false, erro: "Essa sala não está disponível." };

  // quem gerencia pode agendar para outra pessoa do domínio
  let email = ator.email.toLowerCase();
  let nome = ator.nome;
  const para = p.paraEmail?.trim().toLowerCase();
  if (para && para !== email) {
    if (!ator.gestor) return { ok: false, erro: "Você só pode agendar para você mesmo." };
    if (!/^[^@\s]+@locgrupo\.com\.br$/.test(para)) return { ok: false, erro: "Use um e-mail @locgrupo.com.br." };
    email = para;
    nome = (await nomeDoEmail(para)) ?? para.split("@")[0];
  }

  const titulo = p.titulo?.trim().slice(0, 120) || null;
  const { error } = await db().from("sala_reserva").insert({
    sala_id: p.salaId,
    inicio: instanteSP(p.data, p.ini).toISOString(),
    fim: instanteSP(p.data, p.fim).toISOString(),
    titulo,
    email,
    nome,
    criado_por: ator.email.toLowerCase(),
  });
  if (error) {
    // 23P01 = exclusion_violation: outra reserva entrou no mesmo horário
    if (error.code === "23P01") return { ok: false, erro: "Esse horário acabou de ser agendado por outra pessoa. Escolha outro." };
    return { ok: false, erro: "Não foi possível agendar. Tente de novo." };
  }
  return { ok: true };
}

export async function cancelarReserva(ator: Ator, id: string): Promise<Resultado> {
  const { data: r } = await db().from("sala_reserva").select("id, email, fim, status").eq("id", id).maybeSingle();
  if (!r || r.status !== "ATIVA") return { ok: false, erro: "Esse agendamento não existe mais." };
  if (r.email !== ator.email.toLowerCase() && !ator.gestor) return { ok: false, erro: "Só quem agendou pode cancelar." };
  if (new Date(r.fim) <= new Date()) return { ok: false, erro: "Esse horário já terminou." };
  const { error } = await db()
    .from("sala_reserva")
    .update({ status: "CANCELADA", cancelada_em: new Date().toISOString(), cancelada_por: ator.email.toLowerCase() })
    .eq("id", id)
    .eq("status", "ATIVA");
  if (error) return { ok: false, erro: "Não foi possível cancelar. Tente de novo." };
  return { ok: true };
}
