import { contexto, colaboradoresDaUnidade, chamadosAbertos, colunaDoChamado, todosChamados, distribuicaoChamados } from "@/lib/data";
import { DashClient } from "./DashClient";

export const dynamic = "force-dynamic";

export default async function DashPage() {
  const { filtro, permitidas } = await contexto("rh");
  const [colabs, chamados, todos] = await Promise.all([
    colaboradoresDaUnidade(filtro, permitidas),
    chamadosAbertos(),
    todosChamados(),
  ]);
  const distribuicao = distribuicaoChamados(todos);

  const conta = (st: string) => colabs.filter((c) => c.status === st).length;
  const pendentes = chamados.filter((f) => !f.ti_concluido && colunaDoChamado(f) !== "pre").length;

  // Admissões × desligamentos dos últimos 6 meses (dados reais da unidade)
  const meses: { mes: string; a: number; d: number }[] = [];
  const nomes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const hoje = new Date();
  for (let i = 5; i >= 0; i--) {
    const ref = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const chave = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}`;
    meses.push({
      mes: nomes[ref.getMonth()],
      a: colabs.filter((c) => c.admissao?.startsWith(chave)).length,
      d: colabs.filter((c) => c.desligamento?.startsWith(chave)).length,
    });
  }

  const silenciados = new Set(
    chamados.filter((f) => f.silenciado && f.colaborador_id).map((f) => f.colaborador_id as string)
  );
  const slaPorColab: Record<string, string | null> = {};
  for (const f of chamados) if (f.colaborador_id) slaPorColab[f.colaborador_id] = f.sla_alvo;

  const proximas = colabs
    .filter((c) => c.status === "Pré-admissão")
    .map((c) => ({
      id: c.id,
      nome: c.nome,
      cargo: c.cargo ?? "—",
      admissao: c.admissao,
      slaAlvo: slaPorColab[c.id] ?? null,
      silenciado: silenciados.has(c.id),
    }))
    .sort((a, b) => (a.admissao ?? "").localeCompare(b.admissao ?? ""));

  return (
    <DashClient
      unidadeAtual={`${filtro.cidade} · ${filtro.unidade}`}
      stats={{
        ativos: conta("Ativo"),
        afastados: conta("Afastado"),
        pre: conta("Pré-admissão"),
        chamados: pendentes,
      }}
      chart={meses}
      proximas={proximas}
      distribuicao={distribuicao}
    />
  );
}
