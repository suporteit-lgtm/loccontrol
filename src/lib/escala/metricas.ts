// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  Métricas do Dashboard da Escala — funções PURAS (testáveis sem banco).   ║
// ║  Entrada: linhas da view escala_v_presenca e da tabela escala_fila.       ║
// ║  Presença = escala − ausências avisadas − afastamentos.                   ║
// ╚══════════════════════════════════════════════════════════════════════════╝
import { diaDaSemana } from "./calendario";

/** Uma linha de escala_v_presenca (já filtrada por período/grupo/pessoa). */
export interface LinhaPresenca {
  data: string;
  grupo_do_dia: "A" | "B" | null;
  participante_id: string;
  grupo_pessoa: "A" | "B";
  tipo: "ESCALADO" | "RESERVA";
  afastado: boolean;
  ausente: boolean;
  ausente_em_cima: boolean;
  presente: boolean;
}

export interface LinhaFila {
  data: string;
  participante_id: string;
  status: "AGUARDANDO" | "OFERECIDA" | "ATENDIDA" | "EXPIRADA" | "CANCELADA";
  oferta_expira_em: string | null;
}

export interface DiaDash {
  data: string;
  grupo: "A" | "B" | null;
  capacidade: number;
  escalados: number;
  afastados: number;
  ausencias: number;
  emCima: number;
  reservas: number;
  presentes: number;
  /** pessoas que entraram na fila do dia (qualquer status) */
  fila: number;
  /** filas que terminaram sem vaga (EXPIRADA) */
  filaSemAtendimento: number;
  ofertasExpiradas: number;
  futuro: boolean;
}

/** Agrega por dia. `diasUteis` dá a lista de dias (inclusive dias sem ninguém). */
export function porDia(
  diasUteis: { data: string; grupo: "A" | "B" | null }[],
  linhas: readonly LinhaPresenca[],
  fila: readonly LinhaFila[],
  capacidade: number,
  hoje: string,
): DiaDash[] {
  const mapa = new Map<string, DiaDash>();
  for (const d of diasUteis)
    mapa.set(d.data, {
      data: d.data, grupo: d.grupo, capacidade, escalados: 0, afastados: 0, ausencias: 0, emCima: 0,
      reservas: 0, presentes: 0, fila: 0, filaSemAtendimento: 0, ofertasExpiradas: 0, futuro: d.data > hoje,
    });
  for (const l of linhas) {
    const d = mapa.get(l.data);
    if (!d) continue;
    if (l.tipo === "ESCALADO") {
      d.escalados++;
      if (l.afastado) d.afastados++;
      else if (l.ausente) {
        d.ausencias++;
        if (l.ausente_em_cima) d.emCima++;
      }
    } else d.reservas++;
    if (l.presente) d.presentes++;
  }
  for (const f of fila) {
    const d = mapa.get(f.data);
    if (!d) continue;
    d.fila++;
    if (f.status === "EXPIRADA") {
      d.filaSemAtendimento++;
      if (f.oferta_expira_em) d.ofertasExpiradas++;
    }
  }
  return [...mapa.values()].sort((a, b) => a.data.localeCompare(b.data));
}

const pct = (n: number, d: number): number | null => (d > 0 ? Math.round((n / d) * 1000) / 10 : null);

export interface Cards {
  ocupacaoMedia: number | null;
  taxaAusencia: number | null;
  reservasUsadas: number;
  /** vagas que ficaram abertas para agendamento nos dias realizados */
  vagasOferecidas: number;
  diasComFila: number;
  diasRealizados: number;
}

/** Cards do topo — só dias já realizados (até hoje). */
export function cards(dias: readonly DiaDash[]): Cards {
  const r = dias.filter((d) => !d.futuro);
  const base = r.reduce((s, d) => s + (d.escalados - d.afastados), 0);
  return {
    ocupacaoMedia: r.length ? Math.round((r.reduce((s, d) => s + d.presentes / d.capacidade, 0) / r.length) * 1000) / 10 : null,
    taxaAusencia: pct(r.reduce((s, d) => s + d.ausencias, 0), base),
    reservasUsadas: r.reduce((s, d) => s + d.reservas, 0),
    vagasOferecidas: r.reduce((s, d) => s + Math.max(0, d.capacidade - (d.escalados - d.afastados - d.ausencias)), 0),
    diasComFila: r.filter((d) => d.fila > 0).length,
    diasRealizados: r.length,
  };
}

export const NOMES_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** Taxa de ausência por dia da semana (seg–sex). Sem escalados no dia da semana → null. */
export function ausenciaPorSemana(dias: readonly DiaDash[]) {
  return [1, 2, 3, 4, 5].map((ds) => {
    const doDia = dias.filter((d) => !d.futuro && diaDaSemana(d.data) === ds);
    const base = doDia.reduce((s, d) => s + (d.escalados - d.afastados), 0);
    const aus = doDia.reduce((s, d) => s + d.ausencias, 0);
    return { dia: NOMES_SEMANA[ds], ausencias: aus, base, taxa: pct(aus, base) };
  });
}

/** Dias fixos de A e B acumulados mês a mês (dias livres não contam). */
export function abAcumulado(dias: readonly { data: string; grupo: "A" | "B" | null }[]) {
  const out: { mes: string; a: number; b: number }[] = [];
  let a = 0;
  let b = 0;
  for (const d of [...dias].sort((x, y) => x.data.localeCompare(y.data))) {
    if (d.grupo === "A") a++;
    else if (d.grupo === "B") b++;
    else continue;
    const mes = d.data.slice(0, 7);
    if (out.at(-1)?.mes === mes) Object.assign(out.at(-1)!, { a, b });
    else out.push({ mes, a, b });
  }
  return out;
}

export interface PessoaFreq {
  id: string;
  nome: string;
  grupo: "A" | "B";
  escalados: number;
  presencas: number;
  ausencias: number;
  emCima: number;
  afastados: number;
  reservasUsadas: number;
  /** presenças ÷ (escalados − afastamentos); null se não houve dia escalado */
  frequencia: number | null;
}

/** Frequência por pessoa (só dias realizados). */
export function frequencia(
  pessoas: readonly { id: string; nome: string; grupo: "A" | "B" }[],
  linhas: readonly LinhaPresenca[],
  hoje: string,
): PessoaFreq[] {
  const mapa = new Map<string, PessoaFreq>(
    pessoas.map((p) => [p.id, { ...p, escalados: 0, presencas: 0, ausencias: 0, emCima: 0, afastados: 0, reservasUsadas: 0, frequencia: null }]),
  );
  for (const l of linhas) {
    if (l.data > hoje) continue;
    const p = mapa.get(l.participante_id);
    if (!p) continue;
    if (l.tipo === "RESERVA") {
      p.reservasUsadas++;
      continue;
    }
    p.escalados++;
    if (l.afastado) p.afastados++;
    else if (l.ausente) {
      p.ausencias++;
      if (l.ausente_em_cima) p.emCima++;
    } else p.presencas++;
  }
  for (const p of mapa.values()) p.frequencia = pct(p.presencas, p.escalados - p.afastados);
  return [...mapa.values()];
}

/** Demanda reprimida: dias com fila que terminou sem atendimento. */
export function demandaReprimida(dias: readonly DiaDash[]) {
  const comFila = dias.filter((d) => !d.futuro && d.fila > 0);
  const semAtend = comFila.filter((d) => d.filaSemAtendimento > 0);
  return {
    diasSemAtendimento: semAtend.length,
    filaMedia: comFila.length ? Math.round((comFila.reduce((s, d) => s + d.fila, 0) / comFila.length) * 10) / 10 : 0,
    ofertasExpiradas: comFila.reduce((s, d) => s + d.ofertasExpiradas, 0),
    pessoasSemVaga: semAtend.reduce((s, d) => s + d.filaSemAtendimento, 0),
    dias: semAtend.map((d) => ({ data: d.data, fila: d.fila, semAtendimento: d.filaSemAtendimento })),
  };
}

/** Previsão: ocupação esperada e "poucas vagas" (≤ 15% da capacidade livre). */
export function previsao(dias: readonly { data: string; grupo: "A" | "B" | null; capacidade: number; presentes: number }[]) {
  return dias.map((d) => {
    const vagas = d.capacidade - d.presentes;
    return { ...d, vagas, ocupacao: pct(d.presentes, d.capacidade) ?? 0, poucas: vagas <= Math.ceil(d.capacidade * 0.15) };
  });
}

/** CSV com ; (Excel pt-BR) e aspas quando preciso. */
export function csv(cabecalho: string[], linhas: (string | number | null)[][]): string {
  const cel = (v: string | number | null) => {
    const s = v === null ? "" : String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cabecalho, ...linhas].map((l) => l.map(cel).join(";")).join("\n");
}
