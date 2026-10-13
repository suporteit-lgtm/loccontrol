import { redirect } from "next/navigation";
import { usuarioAtual } from "@/lib/session";
import { LoginCard } from "./LoginCard";
import { contaPortal, escalaHabilitada } from "@/lib/escala/auth";
import { semanaDaEscala } from "@/lib/escala/semana";

export default async function LoginPage() {
  const u = await usuarioAtual();
  if (u) redirect(u.papel.includes("T.I") ? "/dash-ti" : "/dash");

  // com a Escala liberada, o login também mostra o cartão do portal do colaborador
  if (escalaHabilitada()) {
    const [semana, conta] = await Promise.all([semanaDaEscala(), contaPortal().catch(() => null)]);
    return (
      <LoginCard
        portal={{ semana, href: conta ? "/escala" : "/escala/auth/login" }}
      />
    );
  }
  return <LoginCard />;
}
