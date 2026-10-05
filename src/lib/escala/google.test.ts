import { describe, expect, it } from "vitest";
import { eventosDesejados } from "./google";

const DIAS = [
  { data: "2026-10-05", grupo: "A" as const },
  { data: "2026-10-06", grupo: null },
  { data: "2026-10-07", grupo: null },
];
const RESERVAS = [
  { data: "2026-10-05", email: "Bia@locgrupo.com.br" },
  { data: "2026-10-06", email: "caio@locgrupo.com.br" },
  { data: "2026-10-06", email: "caio@locgrupo.com.br" },
];
const grupos = { A: "escala-teste-a@locgrupo.com.br", B: "escala-teste-b@locgrupo.com.br" };

describe("Google — eventos desejados", () => {
  it("produção: grupo do dia + quem reservou, sem duplicar; dia livre vazio não vira evento", () => {
    const ev = eventosDesejados(DIAS, RESERVAS, { grupos, permitido: () => true }, "BH · Centro");
    expect(ev.map((e) => e.data)).toEqual(["2026-10-05", "2026-10-06"]);
    expect(ev[0]).toMatchObject({ titulo: "Presencial — Grupo A", convidados: ["escala-teste-a@locgrupo.com.br", "bia@locgrupo.com.br"] });
    expect(ev[1]).toMatchObject({ titulo: "Presencial — dia livre (agendamento)", convidados: ["caio@locgrupo.com.br"] });
  });

  it("teste: quem não está na allowlist nunca é convidado", () => {
    const ev = eventosDesejados(DIAS, RESERVAS, { grupos, permitido: (e) => e === "caio@locgrupo.com.br" }, "BH · Centro");
    expect(ev[0].convidados).toEqual(["escala-teste-a@locgrupo.com.br"]);
    expect(ev[1].convidados).toEqual(["caio@locgrupo.com.br"]);
  });
});
