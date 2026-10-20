import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_VOLTA, DESTINOS_PORTAL as DESTINOS, DOMINIO, escalaHabilitada, supabasePortal } from "@/lib/escala/auth";

export const dynamic = "force-dynamic";

/** Inicia o login Google (hd = domínio da empresa; o servidor revalida no callback). */
export async function GET(req: NextRequest) {
  if (!escalaHabilitada()) return new NextResponse(null, { status: 404 });
  // para onde voltar depois do Google (?volta=salas); fica num cookie para a
  // URL de retorno continuar idêntica à liberada no Supabase
  const volta = req.nextUrl.searchParams.get("volta") === "salas" ? "salas" : "escala";
  const sb = await supabasePortal();
  const { data, error } = await sb.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${req.nextUrl.origin}/escala/auth/callback`,
      queryParams: { hd: DOMINIO, prompt: "select_account" },
    },
  });
  if (error || !data.url) return NextResponse.redirect(new URL(`${DESTINOS[volta]}/login?erro=falha`, req.url));
  const res = NextResponse.redirect(data.url);
  res.cookies.set(COOKIE_VOLTA, volta, { httpOnly: true, sameSite: "lax", secure: req.nextUrl.protocol === "https:", path: "/", maxAge: 600 });
  return res;
}
