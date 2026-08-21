import { db } from "@/lib/db";
import { contexto, unidadesMap, chamadosAbertos } from "@/lib/data";
import { WizardClient } from "./WizardClient";
import type { DraftWizard } from "@/app/actions/wizard";

export const dynamic = "force-dynamic";

export default async function WizardPage() {
  const { usuario, filtro } = await contexto("rh");

  const [{ data: draftRow }, mapa, { data: matrizRows }, { data: gruposRows }, { data: tiUsers }, chamados, { data: eqCat }] =
    await Promise.all([
      db().from("wizard_drafts").select("dados").eq("usuario_id", usuario.id).maybeSingle(),
      unidadesMap(),
      db().from("matriz").select("ligado, obrigatorio, cargos(nome), acessos(nome, ordem)"),
      db().from("grupos_workspace").select("nome, email").order("email"),
      db().from("usuarios").select("nome, papel").eq("status", "aprovado"),
      chamadosAbertos(),
      db().from("equipamentos_catalogo").select("nome, kit").order("ordem"),
    ]);

  // grupo padrão de cada unidade: "Cidade|Unidade" → e-mail do Workspace
  const { data: unidadesRows } = await db().from("unidades").select("nome, email_grupo, cidades(nome)");
  const grupoDaUnidade: Record<string, string | null> = {};
  for (const u of (unidadesRows ?? []) as unknown as {
    nome: string;
    email_grupo: string | null;
    cidades: { nome: string };
  }[]) {
    if (u.cidades?.nome) grupoDaUnidade[`${u.cidades.nome}|${u.nome}`] = u.email_grupo;
  }

  // matriz: cargo → acesso → {on, obrig}
  const matriz: Record<string, Record<string, { on: boolean; obrig: boolean }>> = {};
  const ordem: Record<string, number> = {};
  for (const m of (matrizRows ?? []) as unknown as {
    ligado: boolean;
    obrigatorio: boolean;
    cargos: { nome: string };
    acessos: { nome: string; ordem: number };
  }[]) {
    if (!m.cargos?.nome || !m.acessos?.nome) continue;
    (matriz[m.cargos.nome] ??= {})[m.acessos.nome] = { on: m.ligado, obrig: m.obrigatorio };
    ordem[m.acessos.nome] = m.acessos.ordem;
  }
  const acessos = Object.keys(ordem).sort((a, b) => ordem[a] - ordem[b]);

  // analistas de TI com contagem de chamados na fila
  const analistas = (tiUsers ?? [])
    .filter((t) => t.papel.includes("T.I"))
    .map((t) => ({
      nome: t.nome,
      fila: chamados.filter((f) => f.analista === t.nome).length,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome));

  const cidadePadrao = filtro.cidade;
  const unidadePadrao = mapa[cidadePadrao]?.[0] ?? "";

  const draftPadrao: DraftWizard = {
    step: 1,
    busca: "",
    campos: null,
    cargo: "Atendente de loja",
    cidade: cidadePadrao,
    unidade: unidadePadrao,
    acc: null,
    equip: {},
    // padrão: comunicado@ + o grupo da unidade escolhida
    grupos: ["comunicado@locgrupo.com.br", grupoDaUnidade[`${cidadePadrao}|${unidadePadrao}`]].filter(
      Boolean
    ) as string[],
    grupoLivre: "",
    obs: "",
    analista: analistas[0]?.nome ?? "",
    ticket: null,
  };

  return (
    <WizardClient
      draftInicial={(draftRow?.dados as DraftWizard) ?? draftPadrao}
      draftPadrao={draftPadrao}
      matriz={matriz}
      acessos={acessos}
      cargos={Object.keys(matriz).sort((a, b) => a.localeCompare(b))}
      unidadesMap={mapa}
      grupos={(gruposRows ?? []) as { nome: string; email: string }[]}
      analistas={analistas}
      equipCatalogo={(eqCat ?? []) as { nome: string; kit: boolean }[]}
      grupoDaUnidade={grupoDaUnidade}
    />
  );
}
