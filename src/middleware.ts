import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Separação LocControl × portal da Escala.
 *  • /escala/*: renova a sessão do Supabase Auth (tokens duram 1h).
 *  • Rotas do LocControl: quem só tem sessão do portal (sem lc_sessao) volta para /escala.
 * As páginas e ações continuam checando a sessão por conta própria — isto é roteamento,
 * não a única barreira (o banco também nega via RLS/grants).
 */
export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const habilitada = process.env.ESCALA_HABILITADA === "1";

  if (path === "/escala" || path.startsWith("/escala/")) {
    if (!habilitada || path.startsWith("/escala/auth/")) return NextResponse.next();
    let res = NextResponse.next({ request: req });
    const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (lista) => {
          for (const { name, value } of lista) req.cookies.set(name, value);
          res = NextResponse.next({ request: req });
          for (const { name, value, options } of lista) res.cookies.set(name, value, options);
        },
      },
    });
    await sb.auth.getUser();
    return res;
  }

  // sessão do portal = cookie sb-<projeto>-auth-token (ou seus pedaços .0/.1); o
  // "-code-verifier" é só o temporário do fluxo OAuth e não conta
  const sessaoPortal = req.cookies
    .getAll()
    .some((c) => /^sb-[^-]+-auth-token(\.\d+)?$/.test(c.name));
  // "/" é a escolha do módulo: fica acessível para todos
  if (habilitada && path !== "/" && sessaoPortal && !req.cookies.has("lc_sessao")) {
    return NextResponse.redirect(new URL("/escala", req.url));
  }
  return NextResponse.next();
}

export const config = {
  // tudo menos assets, imagens e rotas de API (que validam a própria sessão)
  matcher: ["/((?!_next/|api/|favicon|manifest|.*\\.(?:png|jpg|jpeg|svg|ico|webp|otf|ttf|woff2?)$).*)"],
};
