// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  E-mail — envio REAL via Gmail API                                       ║
// ║  Usa a mesma service account do Workspace, impersonando a conta          ║
// ║  GOOGLE_ADMIN_IMPERSONATE (os e-mails saem dela).                        ║
// ║  Requer o escopo gmail.send autorizado na delegação em todo o domínio.   ║
// ║  Sem as credenciais configuradas, cai no MOCK (log no console).          ║
// ╚══════════════════════════════════════════════════════════════════════════╝

import { google } from "googleapis";
import { chaveServico, googleConfigurado } from "@/lib/googleKey";

const configurado = googleConfigurado;

function gmail() {
  const key = chaveServico();
  const auth = new google.auth.JWT({
    email: key.client_email,
    key: key.private_key,
    // cliente próprio: se o escopo não estiver autorizado, só o e-mail falha
    scopes: ["https://www.googleapis.com/auth/gmail.send"],
    subject: process.env.GOOGLE_ADMIN_IMPERSONATE,
  });
  return google.gmail({ version: "v1", auth });
}

export interface Anexo {
  nome: string;
  /** Conteúdo do arquivo em base64. */
  b64: string;
  tipo?: string;
}

/** Quebra o base64 em linhas de 76 colunas, como manda o RFC 2045. */
function linhas76(b64: string): string {
  return (b64.match(/.{1,76}/g) ?? []).join("\r\n");
}

function mime(de: string, para: string, assunto: string, corpo: string, anexo?: Anexo): string {
  const cabecalho = [
    `From: LOCCONTROL <${de}>`,
    `To: ${para}`,
    `Subject: =?UTF-8?B?${Buffer.from(assunto).toString("base64")}?=`,
    "MIME-Version: 1.0",
  ];

  let msg: string;
  if (anexo) {
    const sep = `lc_${Date.now().toString(36)}`;
    msg = [
      ...cabecalho,
      `Content-Type: multipart/mixed; boundary="${sep}"`,
      "",
      `--${sep}`,
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
      "",
      linhas76(Buffer.from(corpo).toString("base64")),
      "",
      `--${sep}`,
      `Content-Type: ${anexo.tipo ?? "application/pdf"}; name="${anexo.nome}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${anexo.nome}"`,
      "",
      linhas76(anexo.b64),
      "",
      `--${sep}--`,
    ].join("\r\n");
  } else {
    msg = [
      ...cabecalho,
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
      "",
      linhas76(Buffer.from(corpo).toString("base64")),
    ].join("\r\n");
  }
  return Buffer.from(msg).toString("base64url");
}

export async function enviarEmail(
  para: string,
  assunto: string,
  corpo: string,
  anexo?: Anexo
): Promise<{ ok: boolean; erro?: string }> {
  if (!configurado()) {
    console.log(`[email:mock] para=${para} assunto="${assunto}"${anexo ? ` anexo=${anexo.nome}` : ""}`);
    return { ok: true };
  }
  try {
    await gmail().users.messages.send({
      userId: "me",
      requestBody: { raw: mime(process.env.GOOGLE_ADMIN_IMPERSONATE!, para, assunto, corpo, anexo) },
    });
    return { ok: true };
  } catch (e) {
    const err = e as { errors?: { message?: string }[]; message?: string };
    const m = err?.errors?.[0]?.message ?? err?.message ?? "erro desconhecido";
    if (/unauthorized|not authorized|insufficient|access denied|forbidden|delegation denied/i.test(m))
      return {
        ok: false,
        erro:
          "escopo gmail.send ainda não autorizado — adicione https://www.googleapis.com/auth/gmail.send na delegação do admin console",
      };
    return { ok: false, erro: m };
  }
}

export async function enviarTeste(para: string): Promise<{ ok: boolean; erro?: string }> {
  return enviarEmail(
    para,
    "Notificação de teste — LOCCONTROL",
    "Se você recebeu este e-mail, o canal de notificações por e-mail está funcionando.\n\n— LOCCONTROL"
  );
}
