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
  /** chamado com analista atribuído: navegador E e-mail chegam só para essa
   *  pessoa (+ Superadmin, que sempre recebe) — não pro time inteiro. Sem
   *  destinatário (ex.: pedido de grupo/unidade), segue a regra por time. */
  destinatario?: string | null,
  /** HTML pronto (templateChamado) — substitui o wrapper genérico do e-mail */
  htmlCorpo?: string
) {
  const { error } = await db()
    .from("notificacoes")
    .insert({ tipo, alvo, titulo, corpo, ref: ref ?? null, destinatario: destinatario ?? null });
  // duplicada (mesmo tipo+ref): já foi emitida — não repete nem reenvia e-mail
  if (error) return;

  const { data: usuarios } = await db().from("usuarios").select("*").eq("status", "aprovado");
  const destinatarios = ((usuarios ?? []) as Usuario[]).filter(
    (u) =>
      papelNoAlvo(u.papel, alvo) &&
      u.notif?.email &&
      u.notif?.[tipo] &&
      (!destinatario || u.email === destinatario || u.papel === "Superadmin")
  );

  // e-mails em paralelo; falha de envio não derruba a ação que emitiu
  await Promise.all(
    destinatarios.map((u) =>
      enviarEmail(
        u.email,
        `[LOCCONTROL] ${titulo}`,
        `${corpo}\n\n— LOCCONTROL · notificação automática`,
        undefined,
        htmlCorpo
      ).catch(() => null)
    )
  );
}
