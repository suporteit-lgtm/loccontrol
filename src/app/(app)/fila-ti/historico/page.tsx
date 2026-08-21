import { db } from "@/lib/db";
import { contexto, todosColaboradores } from "@/lib/data";
import { HistoricoChamados, type LinhaHistorico } from "@/components/HistoricoChamados";
import type { Chamado } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Histórico da TI: tudo que passou pela fila — admissões, desligamentos e solicitações. */
export default async function HistoricoTIPage() {
  await contexto("ti");
  const [{ data }, colabs] = await Promise.all([
    db().from("chamados").select("*").not("concluido_em", "is", null).order("concluido_em", { ascending: false }).limit(500),
    todosColaboradores(),
  ]);
  const porId = new Map(colabs.map((c) => [c.id, c]));

  const linhas: LinhaHistorico[] = ((data ?? []) as Chamado[]).map((f) => {
    if (f.payload && "acao" in f.payload) {
      const { acao, cidade, unidade } = f.payload;
      return {
        id: f.id,
        tipo: f.tipo,
        nome: unidade ? `${cidade} · ${unidade}` : cidade,
        detalhe: `solicitado por ${f.solicitante ?? "—"} · ${acao}`,
        resultado: f.resultado ?? "concluido",
        concluidoPor: f.concluido_por ?? "",
        abertoEm: f.criado_em,
        concluidoEm: f.concluido_em!,
      };
    }
    if (f.payload && "gTipo" in f.payload) {
      return {
        id: f.id,
        tipo: f.tipo,
        nome: f.payload.nome || f.payload.email,
        detalhe: `${f.payload.email} · solicitado por ${f.solicitante ?? "—"}`,
        resultado: f.resultado ?? "concluido",
        concluidoPor: f.concluido_por ?? "",
        abertoEm: f.criado_em,
        concluidoEm: f.concluido_em!,
      };
    }
    const c = f.colaborador_id ? porId.get(f.colaborador_id) : undefined;
    return {
      id: f.id,
      tipo: f.tipo,
      nome: c?.nome ?? "—",
      detalhe: [c?.cargo, c?.email, f.analista ? `responsável: ${f.analista}` : ""].filter(Boolean).join(" · "),
      resultado: f.resultado ?? "concluido",
      concluidoPor: f.concluido_por ?? "",
      abertoEm: f.criado_em,
      concluidoEm: f.concluido_em!,
      href: c ? `/colaboradores/${c.id}` : undefined,
    };
  });

  return <HistoricoChamados visao="ti" voltarPara="/fila-ti" linhas={linhas} />;
}
