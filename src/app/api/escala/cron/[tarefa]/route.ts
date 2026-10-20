import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { ehTarefa, rodarTarefa } from "@/lib/escala/jobs";
import { escalaHabilitada } from "@/lib/escala/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function autorizado(req: NextRequest): boolean {
  const segredo = process.env.CRON_SECRET;
  const enviado = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!segredo || enviado.length !== segredo.length) return false;
  return timingSafeEqual(Buffer.from(enviado), Buffer.from(segredo));
}

/** Disparo das automações (pg_cron do Supabase → POST com Authorization: Bearer CRON_SECRET). */
async function handler(req: NextRequest, { params }: { params: Promise<{ tarefa: string }> }) {
  if (!autorizado(req)) return NextResponse.json({ ok: false, erro: "não autorizado" }, { status: 401 });
  if (!escalaHabilitada()) return NextResponse.json({ ok: true, ignorado: "módulo desligado (feature flag)" });
  const { tarefa } = await params;
  if (!ehTarefa(tarefa)) return NextResponse.json({ ok: false, erro: "tarefa desconhecida" }, { status: 404 });
  const r = await rodarTarefa(tarefa, "cron");
  return NextResponse.json(r, { status: r.ok ? 200 : 500 });
}

export { handler as GET, handler as POST };
