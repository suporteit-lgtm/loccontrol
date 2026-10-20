import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { escalaHabilitada } from "@/lib/escala/auth";
import { hojeSP, somarDias } from "@/lib/escala/calendario";

export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
const compacta = (iso: string) => iso.replace(/-/g, "");

/**
 * Feed ICS pessoal (token secreto, revogável em Preferências).
 * Dias do grupo (menos ausências e afastamento) + reservas confirmadas, dos últimos 30 aos próximos 90 dias.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!escalaHabilitada()) return new NextResponse(null, { status: 404 });
  const { token } = await params;
  const hash = createHash("sha256").update(token).digest("hex");
  const { data: pref } = await db()
    .from("escala_preferencia")
    .select("participante_id, escala_participante(ativo, escala_grupo(letra, unidade_id))")
    .eq("ics_token_hash", hash)
    .maybeSingle();
  const part = pref?.escala_participante as unknown as { ativo: boolean; escala_grupo: { letra: string; unidade_id: string } } | undefined;
  if (!pref || !part?.ativo) return new NextResponse("Link inválido ou revogado.", { status: 404 });

  const hoje = hojeSP();
  const de = somarDias(hoje, -30);
  const ate = somarDias(hoje, 90);
  const { letra, unidade_id } = part.escala_grupo;
  const [dias, ausencias, reservas, afast] = await Promise.all([
    db().from("escala_dia").select("data, grupo").eq("unidade_id", unidade_id).gte("data", de).lte("data", ate),
    db().from("escala_ausencia").select("data").eq("participante_id", pref.participante_id).gte("data", de),
    db().from("escala_reserva").select("id, data").eq("participante_id", pref.participante_id)
      .in("status", ["CONFIRMADA", "UTILIZADA"]).gte("data", de).lte("data", ate),
    db().from("escala_afastamento").select("inicio, fim").eq("participante_id", pref.participante_id),
  ]);
  const ausente = new Set((ausencias.data ?? []).map((a) => a.data));
  const afastado = (d: string) => (afast.data ?? []).some((a) => a.inicio <= d && (!a.fim || a.fim >= d));

  const eventos: { uid: string; data: string; titulo: string }[] = [];
  for (const d of dias.data ?? [])
    if (d.grupo === letra && !ausente.has(d.data) && !afastado(d.data))
      eventos.push({ uid: `escala-${unidade_id}-${d.data}`, data: d.data, titulo: `Presencial — Grupo ${letra}` });
  for (const r of reservas.data ?? []) eventos.push({ uid: `reserva-${r.id}`, data: r.data, titulo: "Presencial — reserva" });

  const agora = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const linhas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Locagora//Escala de Presença//PT-BR",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${esc("Escala de Presença")}`,
    "X-WR-TIMEZONE:America/Sao_Paulo",
    ...eventos.flatMap((e) => [
      "BEGIN:VEVENT",
      `UID:${e.uid}@loccontrol.locgrupo.com.br`,
      `DTSTAMP:${agora}`,
      `DTSTART;VALUE=DATE:${compacta(e.data)}`,
      `DTEND;VALUE=DATE:${compacta(somarDias(e.data, 1))}`,
      `SUMMARY:${esc(e.titulo)}`,
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    ]),
    "END:VCALENDAR",
  ];
  return new NextResponse(linhas.join("\r\n"), {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "private, max-age=900" },
  });
}
