import { describe, expect, it } from "vitest";
import {
  diaDaSemana,
  diaUtilAnterior,
  diferencaAB,
  ehDiaUtil,
  grupoFixo,
  grupoRemanejado,
  hojeSP,
  instanteSP,
  materializar,
  motivoBloqueioReserva,
  politicaDeVaga,
  prazoDoDia,
  somarDias,
  vagasLivres,
  validadeOferta,
  type ParametrosEscala,
} from "./calendario";

// Feriados nacionais (incluindo carnaval, como a BrasilAPI devolve) + municipais de BH
const FERIADOS = new Set([
  // 2026
  "2026-01-01", "2026-02-16", "2026-02-17", "2026-04-03", "2026-04-21", "2026-05-01", "2026-06-04",
  "2026-08-15", "2026-09-07", "2026-10-12", "2026-11-02", "2026-11-15", "2026-11-20", "2026-12-08", "2026-12-25",
  // 2027
  "2027-01-01", "2027-02-08", "2027-02-09", "2027-03-26", "2027-04-21", "2027-05-01", "2027-05-27",
  "2027-08-15", "2027-09-07", "2027-10-12", "2027-11-02", "2027-11-15", "2027-11-20", "2027-12-08", "2027-12-25",
  // 2028
  "2028-01-01", "2028-02-28", "2028-02-29", "2028-04-14", "2028-04-21", "2028-05-01", "2028-06-15",
  "2028-08-15", "2028-09-07", "2028-10-12", "2028-11-02", "2028-11-15", "2028-11-20", "2028-12-08", "2028-12-25",
]);

const P: ParametrosEscala = { ancora: "2026-10-05", grupoInicial: "A" };
const INICIO = "2026-10-05";
const FIM_24M = "2028-09-30";

describe("regra fixa — 24 meses simulados com feriados", () => {
  const dias = materializar({ de: INICIO, ate: FIM_24M, params: P, feriados: FERIADOS });

  it("só contém dias úteis (nenhum fim de semana nem feriado)", () => {
    expect(dias.length).toBeGreaterThan(480);
    for (const d of dias) expect(ehDiaUtil(d.data, FERIADOS)).toBe(true);
    for (const f of FERIADOS) expect(dias.find((d) => d.data === f)).toBeUndefined();
  });

  it("terça a quinta são livres, exceto quando recebem o grupo de uma seg/sex feriado", () => {
    for (const d of dias) {
      const dow = diaDaSemana(d.data);
      if (dow === 1 || dow === 5) expect(d.grupo).not.toBeNull();
      else expect(d.grupo).toBe(grupoRemanejado(d.data, P, FERIADOS));
    }
  });

  it("semana 1: segunda A e sexta B; semana 2 inverte; e assim por diante", () => {
    // âncora 05/10/2026 (segunda)
    expect(grupoFixo("2026-10-05", P)).toBe("A");
    expect(grupoFixo("2026-10-09", P)).toBe("B");
    expect(grupoFixo("2026-10-12", P)).toBe("B"); // semana 2 (feriado, mas a regra do dia vale)
    expect(grupoFixo("2026-10-16", P)).toBe("A");
    expect(grupoFixo("2026-10-19", P)).toBe("A"); // semana 3
    expect(grupoFixo("2026-10-23", P)).toBe("B");
    expect(grupoFixo("2026-10-06", P)).toBeNull();
  });

  it("em toda semana, segunda e sexta são de grupos diferentes e a segunda alterna semana a semana", () => {
    for (let seg = P.ancora; seg <= FIM_24M; seg = somarDias(seg, 7)) {
      const a = grupoFixo(seg, P);
      expect(grupoFixo(somarDias(seg, 4), P)).not.toBe(a);
      expect(grupoFixo(somarDias(seg, 7), P)).not.toBe(a);
    }
  });

  it("feriado numa sexta: o dia some, o grupo vem na quarta e o resto da escala não muda", () => {
    const comFeriado = new Set(FERIADOS).add("2027-06-11"); // sexta
    const depois = materializar({ de: INICIO, ate: FIM_24M, params: P, feriados: comFeriado });
    expect(depois.find((d) => d.data === "2027-06-11")).toBeUndefined();
    expect(depois.find((d) => d.data === "2027-06-09")?.grupo).toBe(grupoFixo("2027-06-11", P));
    const resto = (l: typeof dias) => l.filter((d) => d.data !== "2027-06-11" && d.data !== "2027-06-09");
    expect(resto(depois)).toEqual(resto(dias));
  });

  it("casos reais de 2026: a equipe do feriado vem na quarta", () => {
    const g = (d: string) => dias.find((x) => x.data === d)?.grupo;
    expect(g("2026-10-14")).toBe(grupoFixo("2026-10-12", P)); // seg 12/10 (Aparecida, semana 2: B) → qua 14
    expect(g("2026-10-14")).toBe("B");
    expect(g("2026-11-04")).toBe(grupoFixo("2026-11-02", P)); // seg 02/11 (Finados) → qua 04
    expect(g("2026-11-18")).toBe(grupoFixo("2026-11-20", P)); // sex 20/11 (Consciência Negra) → qua 18
    expect(g("2026-10-13")).toBeNull(); // terça continua livre
    expect(g("2026-10-15")).toBeNull(); // quinta continua livre
  });

  it("quarta também feriado: grupo da segunda vai para terça; da sexta, para quinta", () => {
    const f = new Set(["2026-10-19", "2026-10-21"]); // seg + qua
    expect(grupoRemanejado("2026-10-20", P, f)).toBe(grupoFixo("2026-10-19", P));
    const f2 = new Set(["2026-10-23", "2026-10-21"]); // sex + qua
    expect(grupoRemanejado("2026-10-22", P, f2)).toBe(grupoFixo("2026-10-23", P));
  });

  it("segunda e sexta feriado na mesma semana: segunda vai para quarta, sexta para quinta", () => {
    const f = new Set(["2026-10-19", "2026-10-23"]);
    expect(grupoRemanejado("2026-10-21", P, f)).toBe(grupoFixo("2026-10-19", P));
    expect(grupoRemanejado("2026-10-22", P, f)).toBe(grupoFixo("2026-10-23", P));
    expect(grupoRemanejado("2026-10-20", P, f)).toBeNull();
  });

  it("com o remanejamento, nenhum grupo perde dia por feriado em seg/sex (diferença A×B segue pequena)", () => {
    expect(diferencaAB(dias)).toBeLessThanOrEqual(2);
  });

  it("a virada de mês não reinicia nada (grupo depende só da semana)", () => {
    // semana 4 (26–30/10): segunda B, sexta A; semana 5 começa em 02/11: segunda A
    expect(grupoFixo("2026-10-26", P)).toBe("B");
    expect(grupoFixo("2026-10-30", P)).toBe("A");
    expect(grupoFixo("2026-11-02", P)).toBe("A");
  });

  it("dias fixos de A e B ficam equilibrados (sem feriados, diferença 0 a cada 2 semanas)", () => {
    const semFeriado = materializar({ de: INICIO, ate: somarDias(INICIO, 7 * 52 - 1), params: P, feriados: new Set() });
    expect(diferencaAB(semFeriado)).toBe(0);
  });

  it("dias antes da âncora não são escalados", () => {
    const d = materializar({ de: "2026-09-28", ate: "2026-10-06", params: P, feriados: FERIADOS });
    expect(d.map((x) => x.data)).toEqual(["2026-10-05", "2026-10-06"]);
  });

  it("âncora no meio da semana: a semana dela é a semana 1", () => {
    const p = { ancora: "2026-10-07", grupoInicial: "B" as const };
    expect(grupoFixo("2026-10-09", p)).toBe("A"); // sexta da semana 1
    expect(grupoFixo("2026-10-12", p)).toBe("A"); // segunda da semana 2 (inverte: A)
  });
});
describe("vagas por dia", () => {
  it("dia do A (18 escalados) sobra 4; dia do B (17) sobra 5", () => {
    expect(vagasLivres({ capacidade: 22, escalados: 18, ausencias: 0, afastados: 0, reservasConfirmadas: 0 })).toBe(4);
    expect(vagasLivres({ capacidade: 22, escalados: 17, ausencias: 0, afastados: 0, reservasConfirmadas: 0 })).toBe(5);
  });
  it("cada ausência ou afastamento libera uma vaga; reservas consomem", () => {
    expect(vagasLivres({ capacidade: 22, escalados: 18, ausencias: 1, afastados: 1, reservasConfirmadas: 2 })).toBe(4);
  });
  it("grupo acima da capacidade dá vaga negativa (alerta)", () => {
    expect(vagasLivres({ capacidade: 22, escalados: 24, ausencias: 0, afastados: 0, reservasConfirmadas: 0 })).toBe(-2);
  });
});

describe("prazos no fuso de São Paulo", () => {
  it("18:00 em SP = 21:00 UTC", () => {
    expect(instanteSP("2026-10-05", "18:00").toISOString()).toBe("2026-10-05T21:00:00.000Z");
  });
  it("prazo de segunda é sexta 18:00", () => {
    expect(prazoDoDia("2026-10-05", "18:00", FERIADOS).toISOString()).toBe("2026-10-02T21:00:00.000Z");
  });
  it("prazo pula feriado (terça 13/10 → sexta 09/10, pois 12/10 é feriado)", () => {
    expect(diaUtilAnterior("2026-10-13", FERIADOS)).toBe("2026-10-09");
  });
  it("hoje em SP às 23:30 locais (02:30 UTC do dia seguinte)", () => {
    expect(hojeSP(new Date("2026-10-06T02:30:00Z"))).toBe("2026-10-05");
  });
  it("oferta vale 2h, mas nunca passa de 00:00 do dia da vaga", () => {
    const agora = new Date("2026-10-05T22:00:00Z"); // 19:00 SP
    expect(validadeOferta(agora, 120, "2026-10-08").toISOString()).toBe("2026-10-06T00:00:00.000Z");
    const tarde = new Date("2026-10-06T02:30:00Z"); // 23:30 SP do dia 05
    expect(validadeOferta(tarde, 120, "2026-10-06").toISOString()).toBe("2026-10-06T03:00:00.000Z");
  });
  it("antes do prazo atribui ao 1º da fila; depois, oferece", () => {
    const prazo = prazoDoDia("2026-10-06", "18:00", FERIADOS);
    expect(politicaDeVaga(new Date("2026-10-05T20:59:00Z"), prazo)).toBe("ATRIBUIR");
    expect(politicaDeVaga(new Date("2026-10-05T21:00:00Z"), prazo)).toBe("OFERECER");
  });
});

describe("elegibilidade de reserva", () => {
  const base = {
    data: "2026-10-09", hoje: "2026-10-01", util: true, grupoDoDia: "B" as "A" | "B" | null, grupoDaPessoa: "A" as const,
    afastado: false, ativo: true, jaReservado: false, jaNaFila: false, reservasNoMes: 0, limiteMensal: 4 as number | null,
  };
  it("pessoa do outro grupo pode reservar", () => expect(motivoBloqueioReserva(base)).toBeNull());
  it("dia do próprio grupo é bloqueado", () =>
    expect(motivoBloqueioReserva({ ...base, grupoDoDia: "A" })).toBe("DIA_DO_PROPRIO_GRUPO"));
  it("afastado é bloqueado", () => expect(motivoBloqueioReserva({ ...base, afastado: true })).toBe("AFASTADO"));
  it("limite mensal atingido", () =>
    expect(motivoBloqueioReserva({ ...base, reservasNoMes: 4 })).toBe("LIMITE_MENSAL"));
  it("reserva duplicada", () => expect(motivoBloqueioReserva({ ...base, jaReservado: true })).toBe("JA_RESERVADO"));
  it("dia não útil", () => expect(motivoBloqueioReserva({ ...base, util: false, grupoDoDia: null })).toBe("NAO_E_DIA_UTIL"));
  it("dia livre (ter–qui): qualquer grupo agenda", () => {
    expect(motivoBloqueioReserva({ ...base, data: "2026-10-07", grupoDoDia: null, grupoDaPessoa: "A" })).toBeNull();
    expect(motivoBloqueioReserva({ ...base, data: "2026-10-07", grupoDoDia: null, grupoDaPessoa: "B" })).toBeNull();
  });
  it("sem limite configurado: nunca bloqueia por quantidade", () =>
    expect(motivoBloqueioReserva({ ...base, limiteMensal: null, reservasNoMes: 40 })).toBeNull());
  it("hoje ou passado", () => expect(motivoBloqueioReserva({ ...base, data: "2026-10-01" })).toBe("DIA_PASSADO"));
  it("inativo na escala", () => expect(motivoBloqueioReserva({ ...base, ativo: false })).toBe("INATIVO"));
});
