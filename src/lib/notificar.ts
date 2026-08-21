import { db } from "./db";
import { ehAdmin } from "./session";
import { enviarEmail } from "@/services/notificacoes";
import type { Papel, Usuario } from "./types";

export type TipoNotif = "pre" | "chamado" | "sla" | "login" | "grupos";
export type AlvoNotif = "rh" | "ti" | "admins" | "todos";

/**
 * Quem recebe a notificação — pelo TIME da pessoa, não pelo que ela enxerga.
 * `veRH`/`veTI` liberam tela para qualquer admin (um Admin T.I abre as telas do
 * RH), mas avisar a TI de que "a TI concluiu, falta o RH agir" é ruído.
 * O Superadmin continua recebendo tudo, por ser a conta responsável.
 */
function papelNoAlvo(papel: Papel, alvo: AlvoNotif): boolean {
  if (alvo === "todos") return true;
  if (alvo === "admins") return ehAdmin(papel);
  if (papel === "Superadmin") return true;
  return alvo === "rh"
    ? papel === "Usuário RH" || papel === "Admin RH"
    : papel === "Usuário T.I" || papel === "Admin T.I";
}

/**
 * Emite uma notificação do sistema:
 *  · grava na tabela (o navegador entrega via AutoSync, se o usuário tiver o
 *    canal "No sistema" e o evento ligados em Configurações)
 *  · envia e-mail para cada usuário do alvo com o canal "E-mail" e o evento
 *    ligados (via Gmail API)
 * `ref` deduplica: a mesma (tipo, ref) só é emitida uma vez.
 */
export async function emitir(
  tipo: TipoNotif,
  alvo: AlvoNotif,
  titulo: string,
  corpo: string,
  ref?: string,
  /** e-mail: a notificação do NAVEGADOR chega só para essa pessoa (o e-mail segue a regra por time) */
  destinatario?: string | null
) {
  const { error } = await db()
    .from("notificacoes")
    .insert({ tipo, alvo, titulo, corpo, ref: ref ?? null, destinatario: destinatario ?? null });
  // duplicada (mesmo tipo+ref): já foi emitida — não repete nem reenvia e-mail
  if (error) return;

  const { data: usuarios } = await db().from("usuarios").select("*").eq("status", "aprovado");
  const destinatarios = ((usuarios ?? []) as Usuario[]).filter(
    (u) => papelNoAlvo(u.papel, alvo) && u.notif?.email && u.notif?.[tipo]
  );

  // e-mails em paralelo; falha de envio não derruba a ação que emitiu
  await Promise.all(
    destinatarios.map((u) =>
      enviarEmail(u.email, `[LOCCONTROL] ${titulo}`, `${corpo}\n\n— LOCCONTROL · notificação automática`).catch(
        () => null
      )
    )
  );
}
