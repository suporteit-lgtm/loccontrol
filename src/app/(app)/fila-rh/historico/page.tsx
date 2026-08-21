import { db } from "@/lib/db";
import { contexto, todosColaboradores } from "@/lib/data";
import { dataBR } from "@/lib/format";
import { HistoricoChamados, type LinhaHistorico } from "@/components/HistoricoChamados";
import type { Chamado } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Histórico do RH: só o que é de gente — admissões e desligamentos, com cargo,
 * base e datas. Solicitações técnicas (grupos, unidades) ficam no da TI.
 */
export default async function HistoricoRHPage() {
  await contexto("rh");
  const [{ data }, colabs] = await Promise.all([
    db()
      .from("chamados")
      .select("*")
      .not("concluido_em", "is", null)
      .in("tipo", ["Admissão", "Desligamento"])
      .order("concluido_em", { ascending: false })
      .limit(500),
    todosColaboradores(),
  ]);
  const porId = new Map(colabs.map((c) => [c.id, c]));

  const linhas: LinhaHistorico[] = ((data ?? []) as Chamado[]).map((f) => {
    const c = f.colaborador_id ? porId.get(f.colaborador_id) : undefined;
    const base = [c?.cidade, c?.unidade].filter(Boolean).join(" · ");
    const dataRef =
      f.tipo === "Desligamento" ? (c?.desligamento ? `desligado em ${dataBR(c.desligamento)}` : "") : c?.admissao ? `admissão ${dataBR(c.admissao)}` : "";
    return {
      id: f.id,
      tipo: f.tipo,
      nome: c?.nome ?? "—",
      detalhe: [c?.cargo, base, dataRef].filter(Boolean).join(" · "),
      resultado: f.resultado ?? "concluido",
      concluidoPor: f.concluido_por ?? "",
      abertoEm: f.criado_em,
      concluidoEm: f.concluido_em!,
      href: c ? `/colaboradores/${c.id}` : undefined,
    };
  });

  return <HistoricoChamados visao="rh" voltarPara="/fila-rh" linhas={linhas} />;
}
