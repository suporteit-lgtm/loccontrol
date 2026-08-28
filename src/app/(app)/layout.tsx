// server actions (sincronização, ativações no Workspace) podem passar dos 10s
// padrão da Vercel — o tick frio de membros leva ~25s
export const maxDuration = 60;

import { redirect } from "next/navigation";
import { usuarioAtual } from "@/lib/session";
import { unidadesMap, mapaPermitido, filtroPermitido } from "@/lib/data";
import { AppShell } from "@/components/AppShell";
import { AutoSync } from "@/components/AutoSync";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const usuario = await usuarioAtual();
  if (!usuario) redirect("/login");
  const mapa = await unidadesMap();
  const permitido = mapaPermitido(usuario, mapa);
  const filtro = await filtroPermitido(usuario, mapa);

  return (
    <AppShell
      usuario={{ nome: usuario.nome, email: usuario.email, papel: usuario.papel }}
      unidadesMap={permitido}
      filtro={filtro}
    >
      {children}
      <AutoSync />
    </AppShell>
  );
}
