import { db } from "@/lib/db";
import { contexto } from "@/lib/data";
import { MatrizClient } from "./MatrizClient";

export const dynamic = "force-dynamic";

export default async function MatrizPage() {
  await contexto("rh");
  // As listas vêm das tabelas de cargos e acessos — não das linhas da matriz.
  // Derivar da matriz fazia a tela sumir inteira quando ela estava vazia.
  const [{ data: rows }, { data: cargosRows }, { data: acessosRows }] = await Promise.all([
    db().from("matriz").select("ligado, obrigatorio, cargos(nome), acessos(nome)"),
    db().from("cargos").select("nome"),
    db().from("acessos").select("nome, ordem").order("ordem"),
  ]);

  const grid: Record<string, Record<string, { on: boolean; obrig: boolean }>> = {};
  for (const m of (rows ?? []) as unknown as {
    ligado: boolean;
    obrigatorio: boolean;
    cargos: { nome: string };
    acessos: { nome: string };
  }[]) {
    if (!m.cargos?.nome || !m.acessos?.nome) continue;
    (grid[m.cargos.nome] ??= {})[m.acessos.nome] = { on: m.ligado, obrig: m.obrigatorio };
  }
  const acessos = ((acessosRows ?? []) as { nome: string }[]).map((a) => a.nome);
  const cargos = ((cargosRows ?? []) as { nome: string }[])
    .map((c) => c.nome)
    .sort((a, b) => a.localeCompare(b, "pt-BR"));

  return <MatrizClient acessos={acessos} cargos={cargos} grid={grid} />;
}
