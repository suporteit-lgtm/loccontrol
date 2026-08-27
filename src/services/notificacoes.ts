// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  E-mail — envio REAL via Gmail API                                       ║
// ║  Usa a mesma service account do Workspace, impersonando a conta          ║
// ║  GOOGLE_ADMIN_IMPERSONATE (os e-mails saem dela).                        ║
// ║  Requer o escopo gmail.send autorizado na delegação em todo o domínio.   ║
// ║  Sem as credenciais configuradas, cai no MOCK (log no console).          ║
// ╚══════════════════════════════════════════════════════════════════════════╝

import { google } from "googleapis";
import { chaveServico, googleConfigurado } from "@/lib/googleKey";
import { templateChamado } from "./emailChamado";

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

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Corpo em HTML com a identidade visual do LOCCONTROL (azul da marca,
 *  cartão branco, tipografia legível) — mantém o texto puro como fallback
 *  (multipart/alternative), que é quem decide qual mostrar é o cliente de
 *  e-mail, não a gente. A assinatura "— LOCCONTROL..." que os chamadores já
 *  colam no fim do corpo sai daqui: o rodapé do template já cobre isso. */
function corpoHtml(assunto: string, corpo: string): string {
  const semAssinatura = corpo.replace(/\n+—\s*LOCCONTROL[^\n]*$/i, "").trim();
  const paragrafos = semAssinatura
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");

  return `<!doctype html>
<html>
  <body style="margin:0;padding:32px 16px;background:#eef0f4;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;border-collapse:collapse;">
      <tr>
        <td style="padding:0 4px 18px;">
          <span style="font-size:13px;font-weight:800;letter-spacing:0.14em;color:#1a1d21;">LOC<span style="color:#2445b3;">CONTROL</span></span>
        </td>
      </tr>
      <tr>
        <td style="background:#ffffff;border-radius:14px;padding:28px;box-shadow:0 1px 2px rgba(27,42,74,.06),0 8px 24px rgba(27,42,74,.08);">
          <h1 style="margin:0 0 16px;font-size:18px;line-height:1.35;color:#1a1d21;font-weight:700;">${escapeHtml(assunto)}</h1>
          <div style="font-size:14px;line-height:1.6;color:#2b2b2d;">${paragrafos}</div>
        </td>
      </tr>
      <tr>
        <td style="padding:18px 4px 0;">
          <span style="font-size:11px;color:#7a7a7d;">Notificação automática do LOCCONTROL · Grupo LOC</span>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function mime(de: string, para: string, assunto: string, corpo: string, anexo?: Anexo, htmlCustom?: string): string {
  const cabecalho = [
    `From: LOCCONTROL <${de}>`,
    `To: ${para}`,
    `Subject: =?UTF-8?B?${Buffer.from(assunto).toString("base64")}?=`,
    "MIME-Version: 1.0",
  ];

  const alt = `lc_alt_${Date.now().toString(36)}`;
  const alternativo = [
    `--${alt}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    linhas76(Buffer.from(corpo).toString("base64")),
    "",
    `--${alt}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    linhas76(Buffer.from(htmlCustom ?? corpoHtml(assunto, corpo)).toString("base64")),
    "",
    `--${alt}--`,
  ].join("\r\n");

  let msg: string;
  if (anexo) {
    const sep = `lc_${Date.now().toString(36)}`;
    msg = [
      ...cabecalho,
      `Content-Type: multipart/mixed; boundary="${sep}"`,
      "",
      `--${sep}`,
      `Content-Type: multipart/alternative; boundary="${alt}"`,
      "",
      alternativo,
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
    msg = [...cabecalho, `Content-Type: multipart/alternative; boundary="${alt}"`, "", alternativo].join("\r\n");
  }
  return Buffer.from(msg).toString("base64url");
}

export async function enviarEmail(
  para: string,
  assunto: string,
  corpo: string,
  anexo?: Anexo,
  /** HTML pronto (ex.: templateChamado) — substitui o wrapper genérico */
  htmlCustom?: string
): Promise<{ ok: boolean; erro?: string }> {
  if (!configurado()) {
    console.log(`[email:mock] para=${para} assunto="${assunto}"${anexo ? ` anexo=${anexo.nome}` : ""}`);
    return { ok: true };
  }
  try {
    await gmail().users.messages.send({
      userId: "me",
      requestBody: { raw: mime(process.env.GOOGLE_ADMIN_IMPERSONATE!, para, assunto, corpo, anexo, htmlCustom) },
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
    "Se você recebeu este e-mail, o canal de notificações por e-mail está funcionando.\n\n— LOCCONTROL",
    undefined,
    templateChamado({
      eyebrow: "Nova pré-admissão",
      nome: "Fulano de Tal",
      cargo: "Atendente de loja",
      unidade: "Belo Horizonte · Centro",
      responsavel: "Kaique Santos",
      chamadoId: "CH-0000",
      nota: "Isto é um teste — se você recebeu este e-mail com este visual, o canal está funcionando e o template está aplicado.",
      rota: "/fila-ti",
    })
  );
}
