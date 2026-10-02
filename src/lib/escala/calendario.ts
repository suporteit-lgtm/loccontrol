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
  /** Data âncora: o primeiro dia útil a partir dela recebe o grupo inicial. */
  ancora: string;
  grupoInicial: Grupo;
}

export interface DiaEscala {
  data: string;
  grupo: Grupo;
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

/**
 * Quantidade de dias úteis d com ancora ≤ d < data (negativa se data < âncora).
 * Assim o primeiro dia útil a partir da âncora tem índice 0.
 */
export function indiceDiaUtil(ancora: string, data: string, feriados: ReadonlySet<string>): number {
  if (data === ancora) return 0;
  const [ini, fim, sinal] = data > ancora ? [ancora, data, 1] : [data, ancora, -1];
  let n = 0;
  for (let d = ini; d < fim; d = somarDias(d, 1)) if (ehDiaUtil(d, feriados)) n++;
  return n * sinal;
}

/** Grupo de um dia útil pela fórmula da âncora (par = grupo inicial). Null se não for dia útil. */
export function grupoPelaAncora(
  data: string,
  p: ParametrosEscala,
  feriados: ReadonlySet<string>,
): Grupo | null {
  if (!ehDiaUtil(data, feriados)) return null;
  const i = indiceDiaUtil(p.ancora, data, feriados);
  return ((i % 2) + 2) % 2 === 0 ? p.grupoInicial : outroGrupo(p.grupoInicial);
}

/**
 * Materializa a escala no intervalo [de, ate].
 *
 * `base` é o último dia JÁ CONGELADO (passado). Quando existe, a sequência
 * continua alternando a partir dele — então um feriado cadastrado ou removido
 * no passado nunca altera dias já vividos nem desloca a sequência futura.
 * Sem base (primeira materialização), usa a fórmula da âncora.
 */
export function materializar(opts: {
  de: string;
  ate: string;
  params: ParametrosEscala;
  feriados: ReadonlySet<string>;
  base?: DiaEscala | null;
}): DiaEscala[] {
  const { de, ate, params, feriados, base } = opts;
  const out: DiaEscala[] = [];
  if (de > ate) return out;

  let atual: Grupo | null = null;
  let cursor = de;
  if (base && base.data < de) {
    // alterna a partir da base, contando só os dias úteis entre base e `de`
    atual = base.grupo;
    for (let d = somarDias(base.data, 1); d < de; d = somarDias(d, 1))
      if (ehDiaUtil(d, feriados)) atual = outroGrupo(atual);
  }

  for (; cursor <= ate; cursor = somarDias(cursor, 1)) {
    if (!ehDiaUtil(cursor, feriados)) continue;
    if (atual === null) {
      // sem base: dias antes da âncora não são escalados
      if (cursor < params.ancora) continue;
      atual = grupoPelaAncora(cursor, params, feriados)!;
    } else {
      atual = outroGrupo(atual);
    }
    out.push({ data: cursor, grupo: atual });
  }
  return out;
}

/** Diferença acumulada de dias entre A e B (deve ficar sempre em 0 ou 1). */
export function diferencaAB(dias: readonly DiaEscala[]): number {
  let a = 0;
  let b = 0;
  for (const d of dias) d.grupo === "A" ? a++ : b++;
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
  grupoDoDia: Grupo | null;
  grupoDaPessoa: Grupo;
  afastado: boolean;
  ativo: boolean;
  jaReservado: boolean;
  jaNaFila: boolean;
  /** reservas CONFIRMADAS + UTILIZADAS no mês da data */
  reservasNoMes: number;
  limiteMensal: number;
}): MotivoBloqueio | null {
  if (!c.ativo) return "INATIVO";
  if (c.grupoDoDia === null) return "NAO_E_DIA_UTIL";
  if (c.data <= c.hoje) return "DIA_PASSADO";
  if (c.afastado) return "AFASTADO";
  if (c.grupoDoDia === c.grupoDaPessoa) return "DIA_DO_PROPRIO_GRUPO";
  if (c.jaReservado) return "JA_RESERVADO";
  if (c.jaNaFila) return "JA_NA_FILA";
  if (c.reservasNoMes >= c.limiteMensal) return "LIMITE_MENSAL";
  return null;
}

/** Cancelamento de reserva / aviso de ausência sem ser "em cima da hora". */
export function dentroDoPrazo(agora: Date, prazo: Date): boolean {
  return agora < prazo;
}
