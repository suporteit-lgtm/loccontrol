// Agendamento de Salas — regras puras (servidor, navegador e testes).
// Horários sempre como "HH:MM" no fuso de São Paulo; datas como AAAA-MM-DD.
import { diaDaSemana, somarDias } from "@/lib/escala/calendario";

export interface ConfigSalas {
  hora_inicio: string; // "08:00" (o banco devolve "08:00:00")
  hora_fim: string;
  intervalo_min: number;
  dias_antecedencia: number;
  duracao_max_min: number;
  fim_de_semana: boolean;
}

export const CONFIG_PADRAO: ConfigSalas = {
  hora_inicio: "08:00",
  hora_fim: "19:00",
  intervalo_min: 30,
  dias_antecedencia: 30,
  duracao_max_min: 240,
  fim_de_semana: false,
};

export interface Sala {
  id: string;
  nome: string;
  descricao: string | null;
  capacidade: number;
  local: string | null;
  recursos: string[];
  ativo: boolean;
  ordem: number;
}

/** Reserva como as telas recebem (já no horário de São Paulo). */
export interface ReservaVista {
  id: string;
  salaId: string;
  data: string;
  ini: string; // "09:00"
  fim: string; // "10:30"
  titulo: string | null;
  nome: string;
  email: string;
  minha: boolean;
}

/** "08:30" ou "08:30:00" → 510 */
export function minutos(h: string): number {
  const [hh, mm] = h.split(":").map(Number);
  return hh * 60 + (mm || 0);
}

/** 510 → "08:30" */
export function hhmm(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

/** Início de cada faixa do dia: 08:00, 08:30, … (a última termina em hora_fim). */
export function horarios(c: ConfigSalas): string[] {
  const out: string[] = [];
  for (let m = minutos(c.hora_inicio); m + c.intervalo_min <= minutos(c.hora_fim); m += c.intervalo_min) out.push(hhmm(m));
  return out;
}

/** "1h30", "45 min", "2h" */
export function duracao(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} min`;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

export function diaPermitido(data: string, c: ConfigSalas): boolean {
  const d = diaDaSemana(data);
  return c.fim_de_semana || (d !== 0 && d !== 6);
}

/**
 * Por que a reserva não pode ser feita (ou null se pode). Quem gerencia as
 * salas passa por cima da antecedência e da duração máxima, nunca do passado
 * nem do expediente.
 */
export function motivoInvalido(p: {
  data: string;
  ini: string;
  fim: string;
  config: ConfigSalas;
  hoje: string;
  agoraMin: number;
  gestor?: boolean;
}): string | null {
  const { data, config: c } = p;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !/^\d{2}:\d{2}$/.test(p.ini) || !/^\d{2}:\d{2}$/.test(p.fim)) return "Horário inválido.";
  const ini = minutos(p.ini);
  const fim = minutos(p.fim);
  if (fim <= ini) return "O fim precisa ser depois do início.";
  if (ini < minutos(c.hora_inicio) || fim > minutos(c.hora_fim))
    return `As salas funcionam das ${hhmm(minutos(c.hora_inicio))} às ${hhmm(minutos(c.hora_fim))}.`;
  if ((ini - minutos(c.hora_inicio)) % c.intervalo_min || (fim - minutos(c.hora_inicio)) % c.intervalo_min)
    return `Escolha horários de ${c.intervalo_min} em ${c.intervalo_min} minutos.`;
  if (data < p.hoje || (data === p.hoje && fim <= p.agoraMin)) return "Esse horário já passou.";
  // a faixa que está acontecendo agora ainda pode ser reservada
  if (data === p.hoje && ini + c.intervalo_min <= p.agoraMin) return "Esse horário já passou.";
  if (!diaPermitido(data, c)) return "As salas não abrem no fim de semana.";
  if (!p.gestor) {
    if (data > somarDias(p.hoje, c.dias_antecedencia))
      return `Dá para agendar com até ${c.dias_antecedencia} dias de antecedência.`;
    if (fim - ini > c.duracao_max_min) return `Cada agendamento pode ter no máximo ${duracao(c.duracao_max_min)}.`;
  }
  return null;
}

/**
 * Horários de término possíveis a partir de `ini`: de faixa em faixa até a
 * próxima reserva da sala, o fim do expediente ou a duração máxima.
 */
export function finsPossiveis(p: {
  ini: string;
  config: ConfigSalas;
  ocupadas: { ini: string; fim: string }[];
  gestor?: boolean;
}): string[] {
  const c = p.config;
  const ini = minutos(p.ini);
  const proxima = p.ocupadas.map((r) => minutos(r.ini)).filter((m) => m > ini).sort((a, b) => a - b)[0] ?? Infinity;
  const limite = Math.min(minutos(c.hora_fim), proxima, p.gestor ? Infinity : ini + c.duracao_max_min);
  const out: string[] = [];
  for (let m = ini + c.intervalo_min; m <= limite; m += c.intervalo_min) out.push(hhmm(m));
  return out;
}
