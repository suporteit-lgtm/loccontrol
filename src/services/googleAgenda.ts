// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  Google Calendar API — usado pela Escala de Presença.                     ║
// ║  Mesma service account do Workspace, com delegação em todo o domínio,     ║
// ║  agindo como GOOGLE_ADMIN_IMPERSONATE (dono das agendas da escala).       ║
// ║  Escopo necessário na delegação: https://www.googleapis.com/auth/calendar ║
// ║  Toda chamada tem retry com backoff exponencial (429 / 403 rate / 5xx).   ║
// ╚══════════════════════════════════════════════════════════════════════════╝
import { google, type calendar_v3 } from "googleapis";
import { chaveServico, googleConfigurado } from "@/lib/googleKey";

let _cal: calendar_v3.Calendar | null = null;

function cal(): calendar_v3.Calendar {
  if (_cal) return _cal;
  const key = chaveServico();
  const auth = new google.auth.JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: ["https://www.googleapis.com/auth/calendar"],
    subject: process.env.GOOGLE_ADMIN_IMPERSONATE,
  });
  _cal = google.calendar({ version: "v3", auth });
  return _cal;
}

export const agendaConfigurada = googleConfigurado;

export function msgErroGoogle(e: unknown): string {
  const err = e as { errors?: { message?: string }[]; message?: string; response?: { data?: { error_description?: string } } };
  const m = err?.response?.data?.error_description ?? err?.errors?.[0]?.message ?? err?.message ?? "erro desconhecido na API do Google";
  if (/unauthorized_client|not authorized for any of the scopes/i.test(m))
    return "escopo https://www.googleapis.com/auth/calendar ainda não autorizado na delegação do Admin Console";
  return m;
}

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Retry com backoff exponencial (0,5s → 1s → 2s → 4s) só para erros transitórios. */
export async function comRetry<T>(fn: () => Promise<T>, tentativas = 5): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      const st = (e as { code?: number; status?: number }).code ?? (e as { status?: number }).status ?? 0;
      const transitorio = st === 429 || st >= 500 || (st === 403 && /rate|quota/i.test(msgErroGoogle(e)));
      if (!transitorio || i >= tentativas - 1) throw e;
      await espera(500 * 2 ** i + Math.random() * 200);
    }
  }
}

export interface EventoEscala {
  id?: string;
  data: string; // AAAA-MM-DD (dia inteiro)
  titulo: string;
  descricao: string;
  convidados: string[];
}

const fimDoDia = (d: string) => new Date(Date.parse(d) + 86_400_000).toISOString().slice(0, 10);

/** Cria uma agenda secundária (dona: a conta delegada) e devolve o ID. */
export async function criarAgenda(nome: string): Promise<string> {
  const r = await comRetry(() => cal().calendars.insert({ requestBody: { summary: nome, timeZone: "America/Sao_Paulo" } }));
  return r.data.id!;
}

/** Eventos da escala nessa agenda (marcados com a propriedade privada escalaUnidade). */
export async function listarEventos(calendarId: string, unidadeId: string, de: string, ate: string) {
  const out: (EventoEscala & { id: string })[] = [];
  let pageToken: string | undefined;
  do {
    const r = await comRetry(() =>
      cal().events.list({
        calendarId,
        privateExtendedProperty: [`escalaUnidade=${unidadeId}`],
        timeMin: `${de}T00:00:00-03:00`,
        timeMax: `${fimDoDia(ate)}T00:00:00-03:00`,
        singleEvents: true,
        maxResults: 250,
        showDeleted: false,
        pageToken,
      }),
    );
    for (const ev of r.data.items ?? [])
      if (ev.id && ev.start?.date)
        out.push({
          id: ev.id,
          data: ev.start.date,
          titulo: ev.summary ?? "",
          descricao: ev.description ?? "",
          convidados: (ev.attendees ?? []).map((a) => (a.email ?? "").toLowerCase()).filter(Boolean),
        });
    pageToken = r.data.nextPageToken ?? undefined;
  } while (pageToken);
  return out;
}

function corpo(unidadeId: string, e: EventoEscala): calendar_v3.Schema$Event {
  return {
    summary: e.titulo,
    description: e.descricao,
    start: { date: e.data },
    end: { date: fimDoDia(e.data) },
    transparency: "transparent", // não bloqueia a agenda de ninguém
    attendees: e.convidados.map((email) => ({ email })),
    guestsCanModify: false,
    guestsCanInviteOthers: false,
    reminders: { useDefault: false, overrides: [] },
    extendedProperties: { private: { escalaUnidade: unidadeId, escalaData: e.data } },
  };
}

/** sendUpdates "none": a criação em massa não dispara e-mail do Google para ninguém. */
export async function criarEvento(calendarId: string, unidadeId: string, e: EventoEscala): Promise<string> {
  const r = await comRetry(() => cal().events.insert({ calendarId, sendUpdates: "none", requestBody: corpo(unidadeId, e) }));
  return r.data.id!;
}

export async function atualizarEvento(calendarId: string, unidadeId: string, id: string, e: EventoEscala) {
  await comRetry(() => cal().events.update({ calendarId, eventId: id, sendUpdates: "none", requestBody: corpo(unidadeId, e) }));
}

export async function excluirEvento(calendarId: string, id: string) {
  try {
    await comRetry(() => cal().events.delete({ calendarId, eventId: id, sendUpdates: "none" }));
  } catch (e) {
    if (!/not found|deleted/i.test(msgErroGoogle(e))) throw e; // já não existe: ok
  }
}
