import { contexto, colaboradoresDaUnidade, chamadosAbertos, daUnidade, todosColaboradores, todosChamados, distribuicaoChamados } from "@/lib/data";
import { EQUIPAMENTOS } from "@/lib/types";
import { DashTIClient } from "./DashTIClient";

export const dynamic = "force-dynamic";

export default async function DashTIPage() {
  const { filtro } = await contexto("ti");
  const [colabsUnidade, todos, chamados, todosCh] = await Promise.all([
    colaboradoresDaUnidade(filtro),
    todosColaboradores(),
    chamadosAbertos().then((cs) => cs.filter((f) => !f.ti_concluido)),
    todosChamados(),
  ]);
  const porId = new Map(todos.map((c) => [c.id, c]));
  const distribuicao = distribuicaoChamados(todosCh);

  const admPend = colabsUnidade.filter((c) => c.status === "Pré-admissão");
  const desligCol = chamados
    .filter((f) => f.tipo === "Desligamento" && f.colaborador_id)
    .map((f) => porId.get(f.colaborador_id!))
    .filter((c) => c && daUnidade(c, filtro)) as NonNullable<ReturnType<typeof porId.get>>[];

  const contaEq = (lista: { nome: string; equipamentos: string[] }[]) => {
    const m: Record<string, string[]> = {};
    for (const c of lista)
      for (const e of c.equipamentos ?? []) (m[e] ??= []).push(c.nome.split(" ")[0]);
    return EQUIPAMENTOS.filter((e) => m[e]).map((e) => ({ nome: e, n: m[e].length, quem: m[e].join(", ") }));
  };

  const eqEntregar = contaEq(admPend);
  const eqReceber = contaEq(desligCol);

  return (
    <DashTIClient
      unidadeAtual={`${filtro.cidade} · ${filtro.unidade}`}
      stats={{
        admissoes: admPend.length,
        desligamentos: desligCol.length,
        separar: eqEntregar.reduce((a, b) => a + b.n, 0),
        receber: eqReceber.reduce((a, b) => a + b.n, 0),
      }}
      eqEntregar={eqEntregar}
      eqReceber={eqReceber}
      distribuicao={distribuicao}
    />
  );
}
