import { redirect } from "next/navigation";
import { usuarioAtual } from "@/lib/session";
import { escalaHabilitada } from "@/lib/escala/auth";
import { semanaDaEscala } from "@/lib/escala/semana";
import { EscolhaModulo } from "./EscolhaModulo";

export const dynamic = "force-dynamic";

export default async function Home() {
  // com a Escala liberada, a entrada é a escolha do módulo
  if (escalaHabilitada()) return <EscolhaModulo semana={await semanaDaEscala()} />;
  const u = await usuarioAtual();
  if (!u) redirect("/login");
  redirect(u.papel.includes("T.I") ? "/dash-ti" : "/dash");
}
