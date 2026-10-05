import { NextResponse, type NextRequest } from "next/server";
import { clearSessionCookie } from "@/lib/session";
import { supabasePortal } from "@/lib/escala/auth";

export const dynamic = "force-dynamic";

/** Sai do portal (e da sessão do LocControl aberta pelo mesmo login Google, se houver). */
export async function POST(req: NextRequest) {
  const sb = await supabasePortal();
  await sb.auth.signOut();
  await clearSessionCookie();
  return NextResponse.redirect(new URL("/escala/login", req.url), { status: 303 });
}
