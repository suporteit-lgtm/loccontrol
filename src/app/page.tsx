import { redirect } from "next/navigation";
import { usuarioAtual } from "@/lib/session";

export default async function Home() {
  const u = await usuarioAtual();
  if (!u) redirect("/login");
  redirect(u.papel.includes("T.I") ? "/dash-ti" : "/dash");
}
