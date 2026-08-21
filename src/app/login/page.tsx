import { redirect } from "next/navigation";
import { usuarioAtual } from "@/lib/session";
import { LoginCard } from "./LoginCard";

export default async function LoginPage() {
  const u = await usuarioAtual();
  if (u) redirect(u.papel.includes("T.I") ? "/dash-ti" : "/dash");
  return <LoginCard />;
}
