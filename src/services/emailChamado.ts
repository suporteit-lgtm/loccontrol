// Template de e-mail rico pra chamados de admissão/desligamento — extraído de
// email/loccontrol-pre-admissao_2.html (design aprovado). Estrutura em
// tabelas (padrão pra e-mail, Gmail/Outlook não confiam em flex/grid).
import { LOGO_LOCCONTROL_B64 } from "./emailLogo";

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function dataExtenso(d = new Date()): string {
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

function iniciais(nome: string): string {
  const p = nome.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "?") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** URL base do app pra montar o link do botão — configure NEXT_PUBLIC_APP_URL
 *  na Vercel (domínio custom) ou cai no VERCEL_URL automático do deploy. */
function baseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "";
}

export interface DadosEmailChamado {
  eyebrow: string; // "Nova pré-admissão" · "Desligamento"
  nome: string;
  cargo: string;
  unidade: string; // "Cidade · Unidade"
  responsavel: string; // analista
  chamadoId: string;
  status?: string; // default "Aberto"
  nota: string;
  /** rota relativa (ex.: /chamados/CH-1234 ou /offboarding/{colabId}) */
  rota: string;
}

export function templateChamado(d: DadosEmailChamado): string {
  const status = d.status ?? "Aberto";
  const link = `${baseUrl()}${d.rota}`;

  return `<!DOCTYPE html>
<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>${escapeHtml(d.eyebrow)} · LOCCONTROL</title>
<style>
  body, table, td, a { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
  body { margin:0; padding:0; background-color:#eef1f4; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
  table { border-collapse:collapse; }
  img { border:0; display:block; }
  a { text-decoration:none; }
  @media only screen and (max-width: 600px) {
    .container { width:100% !important; border-radius:0 !important; }
    .px-mobile { padding-left:24px !important; padding-right:24px !important; }
    .info-cell { display:block !important; width:100% !important; padding-right:0 !important; }
    .info-cell + .info-cell { padding-top:18px !important; }
    .header-date { display:none !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:#eef1f4;">

  <div style="display:none;font-size:1px;color:#eef1f4;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    Chamado ${escapeHtml(d.chamadoId)} aberto para ${escapeHtml(d.responsavel)} — ${escapeHtml(d.cargo)}, ${escapeHtml(d.unidade)}.
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef1f4;">
    <tr>
      <td align="center" style="padding:40px 16px;">

        <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background-color:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 2px 10px rgba(15,35,54,0.08);">

          <!-- Header -->
          <tr>
            <td style="background-color:#000000;padding:24px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td valign="middle">
                    <img src="data:image/png;base64,${LOGO_LOCCONTROL_B64}" width="210" alt="locagora · Aluguel de Motos" style="display:block;width:210px;max-width:210px;height:auto;">
                  </td>
                  <td align="right" valign="middle" class="header-date">
                    <span style="color:#9a9a9a;font-size:12px;">${dataExtenso()}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Accent bar -->
          <tr>
            <td style="background-color:#2445b3;height:4px;line-height:4px;font-size:0;">&nbsp;</td>
          </tr>

          <!-- Eyebrow -->
          <tr>
            <td class="px-mobile" style="padding:36px 40px 0 40px;">
              <span style="display:inline-block;background-color:#e8edfb;color:#2445b3;font-size:11px;font-weight:700;letter-spacing:0.7px;text-transform:uppercase;padding:6px 13px;border-radius:20px;">${escapeHtml(d.eyebrow)}</span>
            </td>
          </tr>

          <!-- Employee -->
          <tr>
            <td class="px-mobile" style="padding:16px 40px 0 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width:54px;vertical-align:top;">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="width:48px;height:48px;background-color:#2445b3;border-radius:24px;text-align:center;">
                          <span style="color:#ffffff;font-size:16px;font-weight:700;line-height:48px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">${iniciais(d.nome)}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td style="padding-left:14px;vertical-align:middle;">
                    <div style="color:#0f2436;font-size:20px;font-weight:700;line-height:1.35;">${escapeHtml(d.nome)}</div>
                    <div style="color:#66788a;font-size:14px;margin-top:1px;">${escapeHtml(d.cargo)}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td class="px-mobile" style="padding:28px 40px 0 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid #e8ecef;font-size:0;line-height:0;">&nbsp;</td></tr></table>
            </td>
          </tr>

          <!-- Info grid -->
          <tr>
            <td class="px-mobile" style="padding:26px 40px 0 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td class="info-cell" width="50%" style="padding-bottom:22px;padding-right:12px;vertical-align:top;">
                    <div style="color:#96a5b3;font-size:10.5px;font-weight:700;letter-spacing:0.6px;text-transform:uppercase;">Unidade</div>
                    <div style="color:#0f2436;font-size:15px;font-weight:600;margin-top:5px;">${escapeHtml(d.unidade)}</div>
                  </td>
                  <td class="info-cell" width="50%" style="padding-bottom:22px;vertical-align:top;">
                    <div style="color:#96a5b3;font-size:10.5px;font-weight:700;letter-spacing:0.6px;text-transform:uppercase;">Responsável</div>
                    <div style="color:#0f2436;font-size:15px;font-weight:600;margin-top:5px;">${escapeHtml(d.responsavel)}</div>
                  </td>
                </tr>
                <tr>
                  <td class="info-cell" width="50%" style="padding-bottom:8px;padding-right:12px;vertical-align:top;">
                    <div style="color:#96a5b3;font-size:10.5px;font-weight:700;letter-spacing:0.6px;text-transform:uppercase;">Chamado</div>
                    <div style="color:#0f2436;font-size:15px;font-weight:600;margin-top:5px;">${escapeHtml(d.chamadoId)}</div>
                  </td>
                  <td class="info-cell" width="50%" style="padding-bottom:8px;vertical-align:top;">
                    <div style="color:#96a5b3;font-size:10.5px;font-weight:700;letter-spacing:0.6px;text-transform:uppercase;">Status</div>
                    <div style="margin-top:6px;">
                      <span style="display:inline-block;background-color:#e8edfb;color:#2445b3;font-size:12px;font-weight:700;padding:4px 12px;border-radius:20px;">${escapeHtml(status)}</span>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Note -->
          <tr>
            <td class="px-mobile" style="padding:6px 40px 0 40px;">
              <p style="margin:0;color:#66788a;font-size:13.5px;line-height:1.6;">
                ${escapeHtml(d.nota)}
              </p>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td class="px-mobile" align="left" style="padding:22px 40px 36px 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color:#2445b3;border-radius:8px;">
                    <a href="${escapeHtml(link)}" style="display:inline-block;padding:13px 26px;color:#ffffff;font-size:14px;font-weight:600;">Acessar chamado ${escapeHtml(d.chamadoId)} →</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafb;padding:24px 40px;border-top:1px solid #e8ecef;">
              <div style="color:#96a5b3;font-size:12px;line-height:1.7;">
                <strong style="color:#66788a;">LOCCONTROL</strong> · Notificação automática<br>
                Este é um e-mail automático — por favor, não responda.
              </div>
              <div style="color:#c3ccd4;font-size:11px;margin-top:12px;">
                © ${new Date().getFullYear()} LOCGRUPO. Todos os direitos reservados.
              </div>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>`;
}
