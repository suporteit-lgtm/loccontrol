import { redirect } from "next/navigation";
import { usuarioAtual } from "@/lib/session";
import { escalaHabilitada } from "@/lib/escala/auth";
import { EscolhaModulo } from "./EscolhaModulo";

export default async function Home() {
  // com a Escala liberada, a entrada é a escolha do módulo
  if (escalaHabilitada()) return <EscolhaModulo />;
  const u = await usuarioAtual();
  if (!u) redirect("/login");
  redirect(u.papel.includes("T.I") ? "/dash-ti" : "/dash");
}
