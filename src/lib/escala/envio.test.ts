import { describe, expect, it } from "vitest";
import { envioPermitido } from "./envio";

describe("modos de envio", () => {
  const allow = ["ksnkaique@gmail.com", "Kaique.Santos@locgrupo.com.br"];

  it("DESLIGADO: nada sai, nem para a allowlist", () => {
    expect(envioPermitido("DESLIGADO", allow, "ksnkaique@gmail.com")).toBe(false);
    expect(envioPermitido("DESLIGADO", allow, "qualquer@locgrupo.com.br")).toBe(false);
  });

  it("TESTE: só a allowlist (sem diferenciar maiúsculas)", () => {
    expect(envioPermitido("TESTE", allow, "kaique.santos@locgrupo.com.br")).toBe(true);
    expect(envioPermitido("TESTE", allow, " KSNKAIQUE@gmail.com ")).toBe(true);
    expect(envioPermitido("TESTE", allow, "outra.pessoa@locgrupo.com.br")).toBe(false);
    expect(envioPermitido("TESTE", [], "kaique.santos@locgrupo.com.br")).toBe(false);
  });

  it("PRODUÇÃO: envio normal", () => {
    expect(envioPermitido("PRODUCAO", [], "outra.pessoa@locgrupo.com.br")).toBe(true);
  });
});
