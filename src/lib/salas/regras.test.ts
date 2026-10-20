import { describe, expect, it } from "vitest";
import { CONFIG_PADRAO as C, duracao, finsPossiveis, horarios, motivoInvalido } from "./regras";

// 2026-10-08 é quinta-feira
const base = { data: "2026-10-08", config: C, hoje: "2026-10-08", agoraMin: 12 * 60 + 40 };

describe("horarios", () => {
  it("vai do início ao fim do expediente", () => {
    const h = horarios(C);
    expect(h[0]).toBe("08:00");
    expect(h.at(-1)).toBe("18:30");
    expect(h).toHaveLength(22);
  });
  it("aceita o formato do banco (HH:MM:SS)", () => {
    expect(horarios({ ...C, hora_inicio: "09:00:00", hora_fim: "10:00:00", intervalo_min: 15 })).toEqual(["09:00", "09:15", "09:30", "09:45"]);
  });
});

describe("motivoInvalido", () => {
  it("aceita um horário futuro dentro das regras", () => {
    expect(motivoInvalido({ ...base, ini: "14:00", fim: "15:30" })).toBeNull();
  });
  it("aceita a faixa que está acontecendo agora", () => {
    expect(motivoInvalido({ ...base, ini: "12:30", fim: "13:00" })).toBeNull();
  });
  it("recusa o passado", () => {
    expect(motivoInvalido({ ...base, ini: "11:00", fim: "11:30" })).toMatch(/já passou/);
    expect(motivoInvalido({ ...base, ini: "12:00", fim: "13:00" })).toMatch(/já passou/);
    expect(motivoInvalido({ ...base, data: "2026-10-07", ini: "14:00", fim: "15:00" })).toMatch(/já passou/);
  });
  it("recusa fora do expediente, fora da grade e fim antes do início", () => {
    expect(motivoInvalido({ ...base, ini: "18:30", fim: "19:30" })).toMatch(/funcionam/);
    expect(motivoInvalido({ ...base, ini: "14:10", fim: "15:00" })).toMatch(/30 em 30/);
    expect(motivoInvalido({ ...base, ini: "15:00", fim: "14:00" })).toMatch(/depois do início/);
  });
  it("recusa fim de semana, salvo se a configuração permitir", () => {
    expect(motivoInvalido({ ...base, data: "2026-10-10", ini: "10:00", fim: "11:00" })).toMatch(/fim de semana/);
    expect(motivoInvalido({ ...base, data: "2026-10-10", ini: "10:00", fim: "11:00", config: { ...C, fim_de_semana: true } })).toBeNull();
  });
  it("antecedência e duração máxima valem para todos, menos para quem gerencia", () => {
    expect(motivoInvalido({ ...base, data: "2026-11-20", ini: "10:00", fim: "11:00" })).toMatch(/antecedência/);
    expect(motivoInvalido({ ...base, ini: "13:00", fim: "17:30" })).toMatch(/no máximo 4h/);
    expect(motivoInvalido({ ...base, data: "2026-11-20", ini: "10:00", fim: "11:00", gestor: true })).toBeNull();
    expect(motivoInvalido({ ...base, ini: "13:00", fim: "17:30", gestor: true })).toBeNull();
  });
});

describe("finsPossiveis", () => {
  it("para na próxima reserva da sala", () => {
    expect(finsPossiveis({ ini: "09:00", config: C, ocupadas: [{ ini: "10:30", fim: "11:00" }, { ini: "08:00", fim: "08:30" }] })).toEqual([
      "09:30", "10:00", "10:30",
    ]);
  });
  it("respeita a duração máxima e o fim do expediente", () => {
    expect(finsPossiveis({ ini: "09:00", config: C, ocupadas: [] }).at(-1)).toBe("13:00");
    expect(finsPossiveis({ ini: "18:00", config: C, ocupadas: [] })).toEqual(["18:30", "19:00"]);
    expect(finsPossiveis({ ini: "09:00", config: C, ocupadas: [], gestor: true }).at(-1)).toBe("19:00");
  });
});

it("duracao", () => {
  expect([duracao(30), duracao(60), duracao(90), duracao(240)]).toEqual(["30 min", "1h", "1h30", "4h"]);
});
