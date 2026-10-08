import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { setSessionCookie } from "@/lib/session";
import { COOKIE_VOLTA, DESTINOS_PORTAL, emailDoDominio, escalaHabilitada, supabasePortal, vincularConta } from "@/lib/escala/auth";

export const dynamic = "force-dynamic";

/** Retorno do Google: troca o código pela sessão e valida o domínio NO SERVIDOR. */
export async function GET(req: NextRequest) {
  if (!escalaHabilitada()) return new NextResponse(null, { status: 404 });
  // módulo que pediu o login (Escala ou Salas), guardado pela rota /escala/auth/login
  const destino = DESTINOS_PORTAL[req.cookies.get(COOKIE_VOLTA)?.value === "salas" ? "salas" : "escala"];
  const voltar = (erro?: string) => {
    const res = NextResponse.redirect(new URL(erro ? `${destino}/login?erro=${erro}` : destino, req.url));
    res.cookies.delete(COOKIE_VOLTA);
    return res;
  };

  const code = req.nextUrl.searchParams.get("code");
  if (!code) return voltar("falha");

  const sb = await supabasePortal();
  const { data, error } = await sb.auth.exchangeCodeForSession(code);
  const user = data?.user;
  if (error || !user) return voltar("falha");

  // o parâmetro hd do Google é só uma dica — a regra vale aqui
  if (!emailDoDominio(user.email) || user.app_metadata?.provider !== "google") {
    await sb.auth.signOut();
    await db().auth.admin.deleteUser(user.id); // não guarda contas de fora do domínio
    return voltar("dominio");
  }

  const { usuarioInternoId } = await vincularConta(user.id, user.email!);
  if (usuarioInternoId) {
    // usuário interno que entrou pelo Google: mantém o mesmo acesso de hoje no LocControl
    await db().from("usuarios").update({ ultimo_acesso: new Date().toISOString() }).eq("id", usuarioInternoId);
    await setSessionCookie(usuarioInternoId);
  }
  // perfil novo no app_metadata só entra no token após renovar a sessão
  await sb.auth.refreshSession();
  return voltar();
}
