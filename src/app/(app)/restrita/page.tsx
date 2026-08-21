import { contexto, todosColaboradores } from "@/lib/data";
import { RestritaClient } from "./RestritaClient";

export const dynamic = "force-dynamic";

export default async function RestritaPage({
  searchParams,
}: {
  searchParams: Promise<{ alvo?: string }>;
}) {
  const { usuario } = await contexto();
  const sp = await searchParams;
  const grupoTI = usuario.papel === "Superadmin" || usuario.papel.includes("T.I");
  const colabs = await todosColaboradores();
  const ativos = colabs
    .filter((c) => c.status === "Ativo")
    .map((c) => ({ id: c.id, nome: c.nome, bloqueado: c.bloqueado }));

  const alvoInicial =
    sp.alvo && ativos.some((a) => a.id === sp.alvo) ? sp.alvo : ativos[0]?.id ?? "";

  return <RestritaClient ativos={ativos} alvoInicial={alvoInicial} grupoTI={grupoTI} />;
}
