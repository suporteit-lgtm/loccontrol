import { redirect } from "next/navigation";
import { usuarioAtual } from "@/lib/session";
import { LoginCard } from "./LoginCard";
import { contaPortal, escalaHabilitada } from "@/lib/escala/auth";
import { semanaDaEscala, semanaSoDatas } from "@/lib/escala/semana";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ admin?: string }> }) {
  const u = await usuarioAtual();
  if (u) redirect(u.papel.includes("T.I") ? "/dash-ti" : "/dash");
  const { admin } = await searchParams;

  // com a Escala liberada, o login abre no portal do colaborador (Google);
  // RH e TI seguem para o e-mail e senha pelo botão "Acesso administrativo" (ou /login?admin=1)
  if (escalaHabilitada()) {
    const [semana, conta] = await Promise.all([semanaDaEscala(), contaPortal().catch(() => null)]);
    // sem a escala (banco fora do ar, ou no localhost sem chaves) a faixa mostra ao menos as datas
    return <LoginCard admin={admin === "1"} portal={{ semana: semana ?? semanaSoDatas(), href: conta ? "/escala" : "/escala/auth/login" }} />;
  }
  return <LoginCard />;
}
