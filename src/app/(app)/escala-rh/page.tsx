import { carregarDashboard, lerFiltros } from "@/lib/escala/dashboard";
import { DashEscalaClient } from "./DashEscalaClient";

export const dynamic = "force-dynamic";

/** Dashboard da Escala (seção 8): filtros pela URL, números das views do Postgres. */
export default async function DashboardEscalaPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const d = await carregarDashboard(lerFiltros(await searchParams));
  return <DashEscalaClient d={d} />;
}
