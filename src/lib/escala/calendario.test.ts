import { describe, expect, it } from "vitest";
import {
  diaUtilAnterior,
  diferencaAB,
  ehDiaUtil,
  grupoPelaAncora,
  hojeSP,
  instanteSP,
  materializar,
  motivoBloqueioReserva,
  politicaDeVaga,
  prazoDoDia,
  somarDias,
  vagasLivres,
  validadeOferta,
  type DiaEscala,
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

const P: ParametrosEscala = { ancora: "2026-10-01", grupoInicial: "A" };
const INICIO = "2026-10-01";
const FIM_24M = "2028-09-30";

function verificaAlternancia(dias: DiaEscala[]) {
  let a = 0;
  let b = 0;
  dias.forEach((d, i) => {
    d.grupo === "A" ? a++ : b++;
    expect(Math.abs(a - b)).toBeLessThanOrEqual(1);
    if (i > 0) expect(d.grupo).not.toBe(dias[i - 1].grupo);
  });
}

describe("alternância contínua — 24 meses simulados com feriados", () => {
  const dias = materializar({ de: INICIO, ate: FIM_24M, params: P, feriados: FERIADOS });

  it("só contém dias úteis (nenhum fim de semana nem feriado)", () => {
    expect(dias.length).toBeGreaterThan(480);
    for (const d of dias) expect(ehDiaUtil(d.data, FERIADOS)).toBe(true);
    for (const f of FERIADOS) expect(dias.find((d) => d.data === f)).toBeUndefined();
  });

  it("|A − B| ≤ 1 em todo prefixo e os grupos sempre alternam", () => {
    verificaAlternancia(dias);
    expect(diferencaAB(dias)).toBeLessThanOrEqual(1);
  });

  it("o primeiro dia útil a partir da âncora é do grupo inicial", () => {
    expect(dias[0]).toEqual({ data: "2026-10-01", grupo: "A" });
  });

  it("a sequência continua na virada de mês (nunca reinicia)", () => {
    for (let i = 1; i < dias.length; i++) {
      if (dias[i].data.slice(0, 7) !== dias[i - 1].data.slice(0, 7))
        expect(dias[i].grupo).not.toBe(dias[i - 1].grupo);
    }
    // outubro/2026 termina numa sexta (30) — novembro começa no grupo oposto
    const ultOut = dias.filter((d) => d.data.startsWith("2026-10")).at(-1)!;
    const priNov = dias.find((d) => d.data.startsWith("2026-11"))!;
    expect(priNov.grupo).not.toBe(ultOut.grupo);
  });

  it("bate com a fórmula da âncora (paridade de dias úteis)", () => {
    for (const d of dias) expect(grupoPelaAncora(d.data, P, FERIADOS)).toBe(d.grupo);
  });
});

describe("materialização incremental e dias congelados", () => {
  const total = materializar({ de: INICIO, ate: FIM_24M, params: P, feriados: FERIADOS });

  it("materializar em janelas (base = último dia congelado) dá o mesmo resultado", () => {
    const acumulado: DiaEscala[] = [];
    let de = INICIO;
    while (de <= FIM_24M) {
      const ate = somarDias(de, 29) > FIM_24M ? FIM_24M : somarDias(de, 29);
      acumulado.push(...materializar({ de, ate, params: P, feriados: FERIADOS, base: acumulado.at(-1) ?? null }));
      de = somarDias(ate, 1);
    }
    expect(acumulado).toEqual(total);
  });

  it("feriado cadastrado no PASSADO não altera dias congelados nem a sequência futura", () => {
    const hoje = "2027-03-01";
    const congelados = total.filter((d) => d.data < hoje);
    const futuroAntes = total.filter((d) => d.data >= hoje);

    const comFeriadoPassado = new Set(FERIADOS).add("2026-11-10"); // terça já vivida
    const futuroDepois = materializar({
      de: hoje, ate: FIM_24M, params: P, feriados: comFeriadoPassado, base: congelados.at(-1)!,
    });
    expect(futuroDepois).toEqual(futuroAntes);
  });

  it("feriado FUTURO só recalcula daquele dia em diante e mantém |A−B| ≤ 1", () => {
    const hoje = "2027-03-01";
    const congelados = total.filter((d) => d.data < hoje);
    const novo = "2027-06-10"; // quinta
    const feriados2 = new Set(FERIADOS).add(novo);
    const futuro = materializar({ de: hoje, ate: FIM_24M, params: P, feriados: feriados2, base: congelados.at(-1)! });

    const antesDoNovo = total.filter((d) => d.data >= hoje && d.data < novo);
    expect(futuro.filter((d) => d.data < novo)).toEqual(antesDoNovo);
    expect(futuro.find((d) => d.data === novo)).toBeUndefined();
    verificaAlternancia([...congelados, ...futuro]);
  });

  it("remover um feriado futuro também mantém a alternância", () => {
    const hoje = "2027-03-01";
    const congelados = total.filter((d) => d.data < hoje);
    const feriados2 = new Set(FERIADOS);
    feriados2.delete("2027-09-07");
    const futuro = materializar({ de: hoje, ate: FIM_24M, params: P, feriados: feriados2, base: congelados.at(-1)! });
    expect(futuro.find((d) => d.data === "2027-09-07")).toBeDefined();
    verificaAlternancia([...congelados, ...futuro]);
  });

  it("âncora num fim de semana: o primeiro dia útil seguinte recebe o grupo inicial", () => {
    const dias = materializar({
      de: "2026-10-03", ate: "2026-10-09", params: { ancora: "2026-10-03", grupoInicial: "B" }, feriados: FERIADOS,
    });
    expect(dias[0]).toEqual({ data: "2026-10-05", grupo: "B" });
  });

  it("dias antes da âncora não são escalados na primeira materialização", () => {
    const dias = materializar({ de: "2026-09-01", ate: "2026-10-02", params: P, feriados: FERIADOS });
    expect(dias.map((d) => d.data)).toEqual(["2026-10-01", "2026-10-02"]);
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
    data: "2026-10-06", hoje: "2026-10-01", grupoDoDia: "B" as const, grupoDaPessoa: "A" as const,
    afastado: false, ativo: true, jaReservado: false, jaNaFila: false, reservasNoMes: 0, limiteMensal: 4,
  };
  it("pessoa do outro grupo pode reservar", () => expect(motivoBloqueioReserva(base)).toBeNull());
  it("dia do próprio grupo é bloqueado", () =>
    expect(motivoBloqueioReserva({ ...base, grupoDoDia: "A" })).toBe("DIA_DO_PROPRIO_GRUPO"));
  it("afastado é bloqueado", () => expect(motivoBloqueioReserva({ ...base, afastado: true })).toBe("AFASTADO"));
  it("limite mensal atingido", () =>
    expect(motivoBloqueioReserva({ ...base, reservasNoMes: 4 })).toBe("LIMITE_MENSAL"));
  it("reserva duplicada", () => expect(motivoBloqueioReserva({ ...base, jaReservado: true })).toBe("JA_RESERVADO"));
  it("dia não útil", () => expect(motivoBloqueioReserva({ ...base, grupoDoDia: null })).toBe("NAO_E_DIA_UTIL"));
  it("hoje ou passado", () => expect(motivoBloqueioReserva({ ...base, data: "2026-10-01" })).toBe("DIA_PASSADO"));
  it("inativo na escala", () => expect(motivoBloqueioReserva({ ...base, ativo: false })).toBe("INATIVO"));
});
