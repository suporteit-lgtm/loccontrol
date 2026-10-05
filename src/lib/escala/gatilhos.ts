// Disparos imediatos da Escala a partir do resto do LocControl.
// A mudança de status de um colaborador já vira evento no banco (trigger
// escala_status_colaborador); aqui o evento é processado na hora, depois da
// resposta ao usuário (`after`). O job "eventos" do cron é a rede de segurança.
import { after } from "next/server";
import { escalaHabilitada } from "./auth";

export function aposMudancaDeStatus() {
  if (!escalaHabilitada()) return;
  after(async () => {
    try {
      const { rodarTarefa } = await import("./jobs");
      await rodarTarefa("eventos", "status do colaborador");
      // desligado sai do grupo do Workspace; afastado continua no grupo
      const { lerModos } = await import("./envio");
      if ((await lerModos()).modo_google !== "DESLIGADO") await rodarTarefa("google", "status do colaborador");
    } catch (e) {
      console.error("[escala] eventos de status:", (e as Error).message);
    }
  });
}

/**
 * Mudança que afeta a agenda (reserva feita/cancelada, vaga atribuída, troca de
 * grupo, feriado): sincroniza o Google na hora, depois da resposta. Com o modo
 * Google DESLIGADO a tarefa não chama nada externo.
 */
export function aposMudancaNaAgenda() {
  if (!escalaHabilitada()) return;
  after(async () => {
    try {
      const { lerModos } = await import("./envio");
      if ((await lerModos()).modo_google === "DESLIGADO") return;
      const { rodarTarefa } = await import("./jobs");
      await rodarTarefa("google", "mudança na escala");
    } catch (e) {
      console.error("[escala] sincronização Google:", (e as Error).message);
    }
  });
}
