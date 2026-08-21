import { NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/session";
import { tick } from "@/app/actions/sync";

export const dynamic = "force-dynamic";
// primeiro ciclo (152 grupos + membros) leva ~25s — acima dos 10s padrão da Vercel
export const maxDuration = 60;

/**
 * Dispara um ciclo de sincronização com o Workspace.
 * A interface já faz isso sozinha a cada 30s (componente AutoSync); esta rota
 * existe para diagnóstico e para um agendador externo, se um dia for preciso.
 * Exige sessão — não é um endpoint aberto.
 */
export async function GET() {
  const u = await usuarioAtual();
  if (!u) return NextResponse.json({ ok: false, erro: "sem sessão" }, { status: 401 });
  const r = await tick();
  return NextResponse.json(r, { status: r.ok ? 200 : 500 });
}
