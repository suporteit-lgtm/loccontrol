// Templates HTML da Escala de Presença — mesma estrutura do templateChamado
// (tabelas, logo, barra de destaque, CTA), que é o padrão aprovado de e-mail.
import { LOGO_LOCCONTROL_B64 } from "@/services/emailLogo";
import { dataLonga, horaSP } from "./formato";

export function baseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

interface Bloco {
  eyebrow: string;
  titulo: string;
  paragrafos: string[];
  destaque?: { rotulo: string; valor: string }[];
  cta?: { texto: string; rota: string };
  /** cor da barra/eyebrow: accent (padrão), ok, warn, danger */
  tom?: "accent" | "ok" | "warn" | "danger";
}

const TONS = {
  accent: { cor: "#2445b3", fundo: "#e8edfb" },
  ok: { cor: "#2f7d29", fundo: "#e6f4e4" },
  warn: { cor: "#8a6214", fundo: "#f8efdc" },
  danger: { cor: "#b03a2e", fundo: "#f7e4e2" },
};

export function templateEscala(b: Bloco): { html: string; texto: string } {
  const t = TONS[b.tom ?? "accent"];
  const destaque = (b.destaque ?? [])
    .map(
      (d) => `<td class="info-cell" style="padding:0 12px 18px 0;vertical-align:top;">
        <div style="color:#96a5b3;font-size:10.5px;font-weight:700;letter-spacing:0.6px;text-transform:uppercase;">${esc(d.rotulo)}</div>
        <div style="color:#0f2436;font-size:15px;font-weight:600;margin-top:5px;">${esc(d.valor)}</div></td>`,
    )
    .join("");
  const cta = b.cta
    ? `<tr><td class="px-mobile" style="padding:22px 40px 0 40px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="background-color:${t.cor};border-radius:8px;"><a href="${esc(baseUrl() + b.cta.rota)}" style="display:inline-block;padding:13px 26px;color:#ffffff;font-size:14px;font-weight:600;">${esc(b.cta.texto)} →</a></td>
      </tr></table></td></tr>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(b.titulo)} · Escala de Presença</title>
<style>
  body, table, td, a { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
  body { margin:0; padding:0; background-color:#eef1f4; } table { border-collapse:collapse; } img { border:0; display:block; } a { text-decoration:none; }
  @media only screen and (max-width: 600px) {
    .container { width:100% !important; border-radius:0 !important; }
    .px-mobile { padding-left:24px !important; padding-right:24px !important; }
    .info-cell { display:block !important; width:100% !important; }
  }
</style></head>
<body style="margin:0;padding:0;background-color:#eef1f4;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(b.paragrafos[0] ?? b.titulo)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef1f4;"><tr><td align="center" style="padding:40px 16px;">
<table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background-color:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 2px 10px rgba(15,35,54,0.08);">
  <tr><td style="background-color:#000000;padding:24px 40px;">
    <img src="data:image/png;base64,${LOGO_LOCCONTROL_B64}" width="210" alt="locagora" style="display:block;width:210px;max-width:210px;height:auto;">
  </td></tr>
  <tr><td style="background-color:${t.cor};height:4px;line-height:4px;font-size:0;">&nbsp;</td></tr>
  <tr><td class="px-mobile" style="padding:36px 40px 0 40px;">
    <span style="display:inline-block;background-color:${t.fundo};color:${t.cor};font-size:11px;font-weight:700;letter-spacing:0.7px;text-transform:uppercase;padding:6px 13px;border-radius:20px;">${esc(b.eyebrow)}</span>
  </td></tr>
  <tr><td class="px-mobile" style="padding:16px 40px 0 40px;"><div style="color:#0f2436;font-size:22px;font-weight:700;line-height:1.3;">${esc(b.titulo)}</div></td></tr>
  <tr><td class="px-mobile" style="padding:14px 40px 0 40px;">
    ${b.paragrafos.map((p) => `<p style="margin:0 0 10px;color:#4a5a68;font-size:14.5px;line-height:1.6;">${esc(p)}</p>`).join("")}
  </td></tr>
  ${destaque ? `<tr><td class="px-mobile" style="padding:14px 40px 0 40px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr>${destaque}</tr></table></td></tr>` : ""}
  ${cta}
  <tr><td style="padding:36px 0 0 0;"></td></tr>
  <tr><td style="background-color:#f8fafb;padding:24px 40px;border-top:1px solid #e8ecef;">
    <div style="color:#96a5b3;font-size:12px;line-height:1.7;"><strong style="color:#66788a;">Escala de Presença</strong> · Locagora · e-mail automático, não responda.</div>
  </td></tr>
</table></td></tr></table></body></html>`;

  const texto = [b.titulo, "", ...b.paragrafos, ...(b.destaque ?? []).map((d) => `${d.rotulo}: ${d.valor}`),
    ...(b.cta ? ["", `${b.cta.texto}: ${baseUrl()}${b.cta.rota}`] : [])].join("\n");
  return { html, texto };
}

// ── Os seis e-mails do módulo ───────────────────────────────────────────────
export const emailLembrete = (nome: string, data: string, motivo: "grupo" | "reserva", grupo: string) =>
  templateEscala({
    eyebrow: "Lembrete",
    titulo: `Amanhã é dia de escritório`,
    paragrafos: [
      `Olá, ${nome}. Lembrete de que você vai ao escritório amanhã, ${dataLonga(data)}.`,
      motivo === "reserva" ? "Você tem uma reserva confirmada para este dia." : `É o dia do Grupo ${grupo}.`,
      "Não vai poder ir? Avise pelo portal para liberar o seu lugar para outra pessoa.",
    ],
    cta: { texto: "Abrir a escala", rota: "/escala" },
  });

export const emailVagaConfirmada = (nome: string, data: string, viaFila: boolean, prazo: string) =>
  templateEscala({
    eyebrow: "Vaga confirmada",
    tom: "ok",
    titulo: `Sua vaga em ${dataLonga(data)} está confirmada`,
    paragrafos: [
      `Olá, ${nome}. ${viaFila ? "Abriu uma vaga e ela foi atribuída a você pela lista de espera." : "Sua reserva foi registrada."}`,
      `Se não puder ir, cancele até ${horaSP(prazo)} para liberar o lugar.`,
    ],
    cta: { texto: "Ver minhas reservas", rota: "/escala/reservas" },
  });

export const emailVagaOferecida = (nome: string, data: string, expira: string, token: string) =>
  templateEscala({
    eyebrow: "Vaga oferecida",
    tom: "warn",
    titulo: `Abriu uma vaga em ${dataLonga(data)}`,
    paragrafos: [
      `Olá, ${nome}. Você é o próximo da lista de espera.`,
      `A vaga fica reservada para você até ${horaSP(expira)}. Depois disso, ela passa para a próxima pessoa.`,
    ],
    cta: { texto: "Aceitar ou recusar a vaga", rota: `/escala/oferta/${token}` },
  });

const MOTIVOS: Record<string, string> = {
  pessoa: "Você cancelou a reserva.",
  admin: "O RH cancelou a reserva.",
  feriado: "O dia deixou de ser dia útil (feriado ou dia sem expediente).",
  grupo: "A escala mudou e este dia passou a ser do seu próprio grupo — seu lugar está garantido.",
  afastado: "Você está afastado neste período.",
  desligado: "Você não participa mais da escala.",
};

export const emailReservaCancelada = (nome: string, data: string, motivo: string) =>
  templateEscala({
    eyebrow: "Reserva cancelada",
    tom: "danger",
    titulo: `Reserva de ${dataLonga(data)} cancelada`,
    paragrafos: [`Olá, ${nome}. ${MOTIVOS[motivo] ?? "A reserva foi cancelada."}`],
    cta: { texto: "Abrir a escala", rota: "/escala" },
  });

export const emailMudancaEscala = (nome: string, resumo: string[]) =>
  templateEscala({
    eyebrow: "Mudança na escala",
    tom: "warn",
    titulo: "Sua escala mudou",
    paragrafos: [`Olá, ${nome}. Houve uma alteração que afeta os seus dias:`, ...resumo],
    cta: { texto: "Ver calendário", rota: "/escala" },
  });

export const emailResumoRH = (periodo: string, numeros: { rotulo: string; valor: string }[], destaques: string[]) =>
  templateEscala({
    eyebrow: "Resumo semanal",
    titulo: `Escala de Presença — ${periodo}`,
    paragrafos: destaques.length ? destaques : ["Semana sem ocorrências relevantes."],
    destaque: numeros,
    cta: { texto: "Abrir o dashboard", rota: "/escala-rh" },
  });
