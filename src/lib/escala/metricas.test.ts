import { describe, expect, it } from "vitest";
import { abAcumulado, ausenciaPorSemana, cards, csv, demandaReprimida, frequencia, porDia, previsao, type LinhaPresenca } from "./metricas";

const esc = (data: string, pid: string, x: Partial<LinhaPresenca> = {}): LinhaPresenca => ({
  data, grupo_do_dia: "A", participante_id: pid, grupo_pessoa: "A", tipo: "ESCALADO",
  afastado: false, ausente: false, ausente_em_cima: false, presente: true, ...x,
});
const res = (data: string, pid: string): LinhaPresenca =>
  esc(data, pid, { tipo: "RESERVA", grupo_pessoa: "B", grupo_do_dia: null });

// seg 05/10 (A), ter 06/10 (livre), sex 09/10 (B, futuro)
const DIAS = [
  { data: "2026-10-05", grupo: "A" as const },
  { data: "2026-10-06", grupo: null },
  { data: "2026-10-09", grupo: "B" as const },
];
const LINHAS = [
  esc("2026-10-05", "a1"),
  esc("2026-10-05", "a2", { ausente: true, ausente_em_cima: true, presente: false }),
  esc("2026-10-05", "a3", { afastado: true, presente: false }),
  esc("2026-10-05", "a4"),
  res("2026-10-06", "b1"),
  res("2026-10-06", "b2"),
];
const FILA = [
  { data: "2026-10-06", participante_id: "b3", status: "EXPIRADA" as const, oferta_expira_em: "2026-10-05T20:00:00Z" },
  { data: "2026-10-06", participante_id: "b4", status: "EXPIRADA" as const, oferta_expira_em: null },
  { data: "2026-10-06", participante_id: "b5", status: "ATENDIDA" as const, oferta_expira_em: null },
];
const HOJE = "2026-10-06";
const dias = porDia(DIAS, LINHAS, FILA, 4, HOJE);

describe("métricas do dashboard", () => {
  it("agrega por dia: presença = escala − ausências − afastamentos", () => {
    expect(dias[0]).toMatchObject({ escalados: 4, afastados: 1, ausencias: 1, emCima: 1, presentes: 2, futuro: false });
    expect(dias[1]).toMatchObject({ reservas: 2, presentes: 2, fila: 3, filaSemAtendimento: 2, ofertasExpiradas: 1 });
    expect(dias[2].futuro).toBe(true);
  });

  it("cards só com dias realizados", () => {
    const c = cards(dias);
    expect(c.diasRealizados).toBe(2);
    expect(c.ocupacaoMedia).toBe(50); // (2/4 + 2/4) / 2
    expect(c.taxaAusencia).toBe(33.3); // 1 ausência ÷ 3 não afastados
    expect(c.reservasUsadas).toBe(2);
    expect(c.vagasOferecidas).toBe(2 + 4); // seg: 4 − 2 presentes do grupo; ter: livre inteira
    expect(c.diasComFila).toBe(1);
  });

  it("ausência por dia da semana: só segunda tem escalados", () => {
    const s = ausenciaPorSemana(dias);
    expect(s[0]).toMatchObject({ dia: "Seg", taxa: 33.3 });
    expect(s[1].taxa).toBeNull();
  });

  it("A×B acumulado por mês ignora dias livres", () => {
    expect(abAcumulado([...DIAS, { data: "2026-11-02", grupo: "A" }])).toEqual([
      { mes: "2026-10", a: 1, b: 1 },
      { mes: "2026-11", a: 2, b: 1 },
    ]);
  });

  it("frequência por pessoa", () => {
    const f = frequencia([{ id: "a2", nome: "Ana", grupo: "A" }, { id: "a1", nome: "Bia", grupo: "A" }, { id: "b1", nome: "Caio", grupo: "B" }], LINHAS, HOJE);
    expect(f.find((p) => p.id === "a2")).toMatchObject({ escalados: 1, ausencias: 1, emCima: 1, frequencia: 0 });
    expect(f.find((p) => p.id === "a1")).toMatchObject({ presencas: 1, frequencia: 100 });
    expect(f.find((p) => p.id === "b1")).toMatchObject({ reservasUsadas: 1, frequencia: null });
  });

  it("demanda reprimida e previsão", () => {
    expect(demandaReprimida(dias)).toMatchObject({ diasSemAtendimento: 1, pessoasSemVaga: 2, ofertasExpiradas: 1, filaMedia: 3 });
    expect(previsao([{ data: "2026-10-12", grupo: "A", capacidade: 22, presentes: 20 }])[0]).toMatchObject({ vagas: 2, poucas: true });
  });

  it("CSV com ; e aspas", () => {
    expect(csv(["a", "b"], [["x;y", 'diz "oi"'], [1, null]])).toBe('a;b\n"x;y";"diz ""oi"""\n1;');
  });
});
