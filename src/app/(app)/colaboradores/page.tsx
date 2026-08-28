import { contexto, colaboradoresDaUnidade, colaboradoresSemUnidade, contarSemUnidade, ehAdmin } from "@/lib/data";
import { TODAS_CIDADES } from "@/lib/session";
import { ColabsClient } from "./ColabsClient";

export const dynamic = "force-dynamic";
// A exportação para o Drive (server action desta rota) carrega o quadro do
// Quark e sobe várias planilhas — precisa de mais que os 10s padrão.
export const maxDuration = 60;

export default async function ColaboradoresPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; semUnidade?: string }>;
}) {
  const { filtro, usuario, permitidas } = await contexto("rh");
  const sp = await searchParams;
  const soSemUnidade = sp.semUnidade === "1";

  // as contas sem unidade só entram quando o filtro pede — senão apareceriam
  // em toda cidade e dariam a impressão de que o filtro não funciona
  const [lista, nSemUnidade] = await Promise.all([
    soSemUnidade ? colaboradoresSemUnidade() : colaboradoresDaUnidade(filtro, permitidas),
    contarSemUnidade(),
  ]);

  return (
    <ColabsClient
      admin={ehAdmin(usuario.papel)}
      unidadeAtual={filtro.cidade === TODAS_CIDADES ? "Todas as bases do grupo" : `${filtro.cidade} · ${filtro.unidade}`}
      colabs={lista.map((c) => ({
        id: c.id,
        nome: c.nome,
        cpf: c.cpf,
        cargo: c.cargo,
        admissao: c.admissao,
        status: c.status,
        email: c.email,
        unidade: c.unidade,
        cidade: c.cidade,
        origem: (c as { origem?: string }).origem ?? "manual",
        suspenso: (c as { suspenso?: boolean }).suspenso ?? false,
      }))}
      statusInicial={sp.status ?? ""}
      nSemUnidade={nSemUnidade}
      soSemUnidade={soSemUnidade}
      todasAsBases={filtro.cidade === TODAS_CIDADES}
    />
  );
}
