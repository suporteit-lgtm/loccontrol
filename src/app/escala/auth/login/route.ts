import { NextResponse, type NextRequest } from "next/server";
import { DOMINIO, escalaHabilitada, supabasePortal } from "@/lib/escala/auth";

export const dynamic = "force-dynamic";

/** Inicia o login Google (hd = domínio da empresa; o servidor revalida no callback). */
export async function GET(req: NextRequest) {
  if (!escalaHabilitada()) return new NextResponse(null, { status: 404 });
  const sb = await supabasePortal();
  const { data, error } = await sb.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${req.nextUrl.origin}/escala/auth/callback`,
      queryParams: { hd: DOMINIO, prompt: "select_account" },
    },
  });
  if (error || !data.url) return NextResponse.redirect(new URL("/escala/login?erro=falha", req.url));
  return NextResponse.redirect(data.url);
}
