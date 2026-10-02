// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  Escala de Presença — regra central (módulo PURO: sem banco, sem I/O)     ║
// ║                                                                          ║
// ║  Datas de calendário são strings ISO "AAAA-MM-DD" e a aritmética é feita  ║
// ║  em UTC, então o fuso da máquina nunca altera o resultado. Instantes      ║
// ║  (prazos, validade de oferta) são calculados no fuso America/Sao_Paulo.  ║
// ╚══════════════════════════════════════════════════════════════════════════╝

export type Grupo = "A" | "B";
export const FUSO = "America/Sao_Paulo";

export interface ParametrosEscala {
  /** Data âncora: a semana que a contém é a "semana 1" (segunda = grupo inicial). */
  ancora: string;
  grupoInicial: Grupo;
}

/**
 * Um dia útil da escala. `grupo` é o grupo FIXO do dia (segunda e sexta);
 * null = dia LIVRE (terça a quinta): sem equipe fixa, qualquer pessoa agenda.
 */
export interface DiaEscala {
  data: string;
  grupo: Grupo | null;
}
// ── Datas de calendário ──────────────────────────────────────────────────────
const DIA_MS = 86_400_000;

function paraUTC(iso: string): number {
  const [a, m, d] = iso.split("-").map(Number);
  return Date.UTC(a, m - 1, d);
}

function deUTC(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function somarDias(iso: string, n: number): string {
  return deUTC(paraUTC(iso) + n * DIA_MS);
}

/** 0 = domingo … 6 = sábado */
export function diaDaSemana(iso: string): number {
  return new Date(paraUTC(iso)).getUTCDay();
}

export function ehFimDeSemana(iso: string): boolean {
  const d = diaDaSemana(iso);
  return d === 0 || d === 6;
}

/** Dia útil = segunda a sexta que não seja feriado nem dia sem expediente. */
export function ehDiaUtil(iso: string, feriados: ReadonlySet<string>): boolean {
  return !ehFimDeSemana(iso) && !feriados.has(iso);
}

export function outroGrupo(g: Grupo): Grupo {
  return g === "A" ? "B" : "A";
}

export function proximoDiaUtil(iso: string, feriados: ReadonlySet<string>): string {
  let d = somarDias(iso, 1);
  while (!ehDiaUtil(d, feriados)) d = somarDias(d, 1);
  return d;
}

export function diaUtilAnterior(iso: string, feriados: ReadonlySet<string>): string {
  let d = somarDias(iso, -1);
  while (!ehDiaUtil(d, feriados)) d = somarDias(d, -1);
  return d;
}

/** Segunda-feira da semana da data. */
export function segundaDaSemana(iso: string): string {
  const d = diaDaSemana(iso); // 0 dom … 6 sáb
  return somarDias(iso, d === 0 ? -6 : 1 - d);
}

/** Semanas desde a semana da âncora (0 = semana da âncora; negativo antes dela). */
export function indiceSemana(ancora: string, data: string): number {
  return Math.round((paraUTC(segundaDaSemana(data)) - paraUTC(segundaDaSemana(ancora))) / (7 * DIA_MS));
}

/**
 * Regra fixa por dia da semana:
 *   semana par (1, 3, 5…): segunda = grupo inicial, sexta = o outro;
 *   semana ímpar (2, 4, 6…): inverte;
 *   terça a quinta: sem grupo (dia livre para agendamento).
 * Feriado não desloca nada — o dia apenas deixa de existir na escala.
 */
export function grupoFixo(data: string, p: ParametrosEscala): Grupo | null {
  const dow = diaDaSemana(data);
  if (dow !== 1 && dow !== 5) return null;
  const semanaPar = ((indiceSemana(p.ancora, data) % 2) + 2) % 2 === 0;
  const segunda = semanaPar ? p.grupoInicial : outroGrupo(p.grupoInicial);
  return dow === 1 ? segunda : outroGrupo(segunda);
}

/**
 * Remanejamento por feriado: se a segunda ou a sexta da semana não é dia útil
 * (feriado ou sem expediente), o grupo daquele dia vem na QUARTA da mesma semana.
 *   • quarta indisponível → próximo dia livre da semana
 *     (grupo da segunda: qua, ter, qui · grupo da sexta: qua, qui, ter);
 *   • segunda e sexta feriado na mesma semana → segunda fica com a quarta e a
 *     sexta vai para a quinta (os dois grupos juntos não cabem no escritório).
 * Devolve o grupo remanejado para `data` (ter–qui) ou null.
 */
export function grupoRemanejado(data: string, p: ParametrosEscala, feriados: ReadonlySet<string>): Grupo | null {
  const dow = diaDaSemana(data);
  if (dow < 2 || dow > 4 || !ehDiaUtil(data, feriados)) return null;
  const seg = segundaDaSemana(data);
  const [ter, qua, qui, sex] = [1, 2, 3, 4].map((n) => somarDias(seg, n));
  const ocupados = new Map<string, Grupo>();
  const remaneja = (diaFixo: string, ordem: string[]) => {
    if (diaFixo < p.ancora || ehDiaUtil(diaFixo, feriados)) return; // dia fixo normal: nada a fazer
    const destino = ordem.find((d) => d >= p.ancora && ehDiaUtil(d, feriados) && !ocupados.has(d));
    if (destino) ocupados.set(destino, grupoFixo(diaFixo, p)!);
  };
  remaneja(seg, [qua, ter, qui]);
  remaneja(sex, [qua, qui, ter]);
  return ocupados.get(data) ?? null;
}

/** Grupo de um dia útil: fixo (seg/sex), remanejado por feriado (ter–qui) ou null = livre. */
export function grupoDoDia(data: string, p: ParametrosEscala, feriados: ReadonlySet<string>): Grupo | null {
  return grupoFixo(data, p) ?? grupoRemanejado(data, p, feriados);
}

/**
 * Materializa a escala no intervalo [de, ate]: todo dia útil a partir da âncora,
 * com o grupo fixo (seg/sex), remanejado por feriado ou livre (ter–qui). Função
 * pura da data — dias já vividos não mudam porque o banco os congela (0025).
 */
export function materializar(opts: {
  de: string;
  ate: string;
  params: ParametrosEscala;
  feriados: ReadonlySet<string>;
}): DiaEscala[] {
  const { de, ate, params, feriados } = opts;
  const out: DiaEscala[] = [];
  for (let d = de < params.ancora ? params.ancora : de; d <= ate; d = somarDias(d, 1))
    if (ehDiaUtil(d, feriados)) out.push({ data: d, grupo: grupoDoDia(d, params, feriados) });
  return out;
}

/** Diferença acumulada de dias fixos entre A e B (dias livres não contam). */
export function diferencaAB(dias: readonly DiaEscala[]): number {
  let a = 0;
  let b = 0;
  for (const d of dias) if (d.grupo === "A") a++;
  else if (d.grupo === "B") b++;
  return Math.abs(a - b);
}
// ── Vagas ────────────────────────────────────────────────────────────────────
/**
 * vagas_livres = capacidade − (escalados − ausências avisadas − afastados) − reservas confirmadas
 * Pode ser negativa se um grupo passar da capacidade (a interface alerta o RH).
 */
export function vagasLivres(v: {
  capacidade: number;
  escalados: number;
  ausencias: number;
  afastados: number;
  reservasConfirmadas: number;
}): number {
  const presentes = Math.max(0, v.escalados - v.ausencias - v.afastados);
  return v.capacidade - presentes - v.reservasConfirmadas;
}

// ── Instantes no fuso de São Paulo ───────────────────────────────────────────
/** Deslocamento (min) do fuso em relação ao UTC naquele instante. Ex.: −180. */
function offsetMin(instante: number, fuso = FUSO): number {
  const nome = new Intl.DateTimeFormat("en-US", { timeZone: fuso, timeZoneName: "longOffset" })
    .formatToParts(new Date(instante))
    .find((p) => p.type === "timeZoneName")!.value; // "GMT-03:00" ou "GMT"
  const m = nome.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!m) return 0;
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
}

/** Instante (Date) correspondente a "data às HH:MM" no horário de São Paulo. */
export function instanteSP(data: string, hora: string): Date {
  const [h, m] = hora.split(":").map(Number);
  const ingenuo = paraUTC(data) + (h * 60 + m) * 60_000;
  // duas passadas resolvem a virada de horário de verão, se um dia voltar
  let t = ingenuo - offsetMin(ingenuo) * 60_000;
  t = ingenuo - offsetMin(t) * 60_000;
  return new Date(t);
}

/** Data de hoje (AAAA-MM-DD) no horário de São Paulo. */
export function hojeSP(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO }).format(agora);
}

/** Prazo de cancelamento / aviso de ausência: HH:MM do dia útil anterior. */
export function prazoDoDia(data: string, prazoHora: string, feriados: ReadonlySet<string>): Date {
  return instanteSP(diaUtilAnterior(data, feriados), prazoHora);
}

/** Validade de uma oferta: o que vier primeiro entre agora + validade e 00:00 do dia da vaga. */
export function validadeOferta(agora: Date, validadeMin: number, dataVaga: string): Date {
  const limite = instanteSP(dataVaga, "00:00").getTime();
  return new Date(Math.min(agora.getTime() + validadeMin * 60_000, limite));
}

/** Antes do prazo a vaga é atribuída ao 1º da fila; depois, é oferecida. */
export function politicaDeVaga(agora: Date, prazo: Date): "ATRIBUIR" | "OFERECER" {
  return agora < prazo ? "ATRIBUIR" : "OFERECER";
}

// ── Elegibilidade (mesmas regras que as funções SQL aplicam com lock) ────────
export type MotivoBloqueio =
  | "NAO_E_DIA_UTIL"
  | "DIA_PASSADO"
  | "DIA_DO_PROPRIO_GRUPO"
  | "AFASTADO"
  | "INATIVO"
  | "JA_RESERVADO"
  | "JA_NA_FILA"
  | "LIMITE_MENSAL";

export const MENSAGEM_BLOQUEIO: Record<MotivoBloqueio, string> = {
  NAO_E_DIA_UTIL: "Este dia não é útil (fim de semana, feriado ou sem expediente).",
  DIA_PASSADO: "As reservas para este dia já foram encerradas.",
  DIA_DO_PROPRIO_GRUPO: "Este já é o dia do seu grupo — seu lugar está garantido, não é preciso reservar.",
  AFASTADO: "Durante o afastamento não é possível reservar nem entrar na fila.",
  INATIVO: "Você não está ativo nesta escala. Procure o RH.",
  JA_RESERVADO: "Você já tem uma reserva para este dia.",
  JA_NA_FILA: "Você já está na fila deste dia.",
  LIMITE_MENSAL: "Você atingiu o limite de reservas deste mês.",
};

export function motivoBloqueioReserva(c: {
  data: string;
  hoje: string;
  /** false = fim de semana, feriado ou fora da escala */
  util: boolean;
  /** grupo fixo do dia; null = dia livre (ter–qui) */
  grupoDoDia: Grupo | null;
  grupoDaPessoa: Grupo;
  afastado: boolean;
  ativo: boolean;
  jaReservado: boolean;
  jaNaFila: boolean;
  /** reservas CONFIRMADAS + UTILIZADAS no mês da data */
  reservasNoMes: number;
  /** null = sem limite */
  limiteMensal: number | null;
}): MotivoBloqueio | null {
  if (!c.ativo) return "INATIVO";
  if (!c.util) return "NAO_E_DIA_UTIL";
  if (c.data <= c.hoje) return "DIA_PASSADO";
  if (c.afastado) return "AFASTADO";
  if (c.grupoDoDia === c.grupoDaPessoa) return "DIA_DO_PROPRIO_GRUPO";
  if (c.jaReservado) return "JA_RESERVADO";
  if (c.jaNaFila) return "JA_NA_FILA";
  if (c.limiteMensal !== null && c.reservasNoMes >= c.limiteMensal) return "LIMITE_MENSAL";
  return null;
}

/** Cancelamento de reserva / aviso de ausência sem ser "em cima da hora". */
export function dentroDoPrazo(agora: Date, prazo: Date): boolean {
  return agora < prazo;
}
