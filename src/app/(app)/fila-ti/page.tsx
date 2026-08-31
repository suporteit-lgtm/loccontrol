import { db } from "@/lib/db";
import { contexto, chamadosAbertos, todosColaboradores, ehAdmin } from "@/lib/data";
import { dataBR } from "@/lib/format";
import { pendenciasTI } from "@/lib/pendencias";
import { FilaTIClient, type CardTI } from "./FilaTIClient";

export const dynamic = "force-dynamic";

export default async function FilaTIPage() {
  const { usuario, permitidas } = await contexto("ti");
  const [chamados, colabs, { data: matriz }, { data: timeTI }] = await Promise.all([
    chamadosAbertos(),
    todosColaboradores(),
    db().from("matriz").select("ligado, cargos(nome), acessos(nome)"),
    db().from("usuarios").select("nome").eq("status", "aprovado").ilike("papel", "%T.I%").order("nome"),
  ]);
  const porId = new Map(colabs.map((c) => [c.id, c]));

  // acessos do cargo, usados quando a pré-admissão é anterior à seleção do RH
  const doCargo = new Map<string, string[]>();
  for (const m of (matriz ?? []) as unknown as {
    ligado: boolean;
    cargos: { nome: string };
    acessos: { nome: string };
  }[]) {
    if (!m.ligado || !m.cargos?.nome) continue;
    doCargo.set(m.cargos.nome, [...(doCargo.get(m.cargos.nome) ?? []), m.acessos.nome]);
  }

  // O isolamento por analista vive no FILTRO da tela: a fila abre mostrando
  // só os chamados do usuário logado, e o seletor permite ver a fila de outro
  // analista ou a geral (sem responsável) — por isso todos os cards descem.

  // usuário restrito a unidades só vê chamados de colaboradores das bases dele
  const daMinhaBase = (f: (typeof chamados)[number]) => {
    if (!permitidas || f.payload || !f.colaborador_id) return true;
    const c = porId.get(f.colaborador_id);
    if (!c?.cidade || !c?.unidade) return true; // sem lotação: não dá pra atribuir
    return permitidas.has(`${c.cidade}|${c.unidade}`);
  };

  // ti_concluido: a ferramenta de chamados encerrou a parte da TI — o chamado
  // continua vivo para o RH (offboarding), mas não é mais pendência da TI
  const cards: CardTI[] = chamados.filter((f) => !f.ti_concluido && daMinhaBase(f)).map((f) => {
    if (f.payload && "acao" in f.payload) {
      const { acao, cidade, unidade } = f.payload;
      return {
        kind: "unid",
        id: f.id,
        nome: unidade ? `${cidade} · ${unidade}` : cidade,
        sub:
          acao === "add-cidade"
            ? "criar cidade"
            : acao === "add-unid"
              ? "criar unidade"
              : acao === "del-unid"
                ? "remover unidade"
                : "remover cidade e suas unidades",
        tipo: f.tipo,
        slaAlvo: null,
        silenciado: false,
        colabId: null,
        data: "",
      };
    }
    if (f.payload && "gTipo" in f.payload) {
      return {
        kind: "grupo",
        id: f.id,
        nome: f.payload.nome || f.payload.email,
        sub: f.payload.email,
        tipo: f.tipo,
        gTipo: f.payload.gTipo,
        slaAlvo: null,
        silenciado: false,
        colabId: null,
        data: "solicitado pelo RH",
      };
    }
    const c = f.colaborador_id ? porId.get(f.colaborador_id) : undefined;
    // a seleção do RH manda; sem ela (pré-admissão antiga) cai na matriz do cargo
    const acessos = c ? (c.acessos ?? doCargo.get(c.cargo ?? "") ?? []) : [];
    return {
      kind: "colab",
      id: f.id,
      nome: c?.nome ?? "—",
      sub: `${c?.cargo ?? ""}${f.solicitante ? ` · aberto por ${f.solicitante}` : ""}`,
      tipo: f.tipo,
      data: f.tipo === "Desligamento" ? dataBR(c?.desligamento) : dataBR(c?.admissao),
      slaAlvo: f.sla_alvo,
      silenciado: f.silenciado,
      colabId: f.colaborador_id,
      analista: f.analista ?? null,
      email: f.tipo === "Admissão" && c?.status !== "Ativo" ? c?.email ?? null : null,
      pendencias: f.tipo === "Admissão" ? pendenciasTI(c, acessos) : [],
    };
  });

  return (
    <FilaTIClient
      cards={cards}
      admin={ehAdmin(usuario.papel)}
      analistas={(timeTI ?? []).map((t) => t.nome as string)}
      usuarioNome={usuario.nome}
    />
  );
}
