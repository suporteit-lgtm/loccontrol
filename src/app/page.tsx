import { redirect } from "next/navigation";
import { usuarioAtual } from "@/lib/session";
import { contaPortal, escalaHabilitada } from "@/lib/escala/auth";
import { semanaDaEscala } from "@/lib/escala/semana";
import { EscolhaModulo } from "./EscolhaModulo";

export const dynamic = "force-dynamic";

export default async function Home() {
  // com a Escala liberada, a entrada é a escolha do módulo
  // o cartão da Escala vai direto: já logado no portal → /escala; senão → login do Google
  if (escalaHabilitada()) {
    const [semana, conta] = await Promise.all([semanaDaEscala(), contaPortal().catch(() => null)]);
    return (
      <EscolhaModulo
        semana={semana}
        hrefEscala={conta ? "/escala" : "/escala/auth/login"}
        hrefSalas={conta ? "/salas" : "/escala/auth/login?volta=salas"}
      />
    );
  }
  const u = await usuarioAtual();
  if (!u) redirect("/login");
  redirect(u.papel.includes("T.I") ? "/dash-ti" : "/dash");
}
