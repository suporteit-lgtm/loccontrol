import { db } from "@/lib/db";
import { contexto, unidadesMap, chamadosAbertos, ehAdmin } from "@/lib/data";
import { UnidadesClient } from "./UnidadesClient";

export const dynamic = "force-dynamic";

export default async function UnidadesPage() {
  const { usuario } = await contexto("ti");
  const [mapa, chamados, { data: unidadesRows }] = await Promise.all([
    unidadesMap(),
    chamadosAbertos(),
    db().from("unidades").select("nome, email_grupo, cidades(nome)"),
  ]);

  const pendencias = chamados
    .filter((f) => f.payload && "acao" in f.payload)
    .map((f) => f.payload as { acao: string; cidade: string; unidade?: string });

  const grupos: Record<string, string | null> = {};
  for (const u of (unidadesRows ?? []) as unknown as {
    nome: string;
    email_grupo: string | null;
    cidades: { nome: string };
  }[]) {
    if (u.cidades?.nome) grupos[`${u.cidades.nome}|${u.nome}`] = u.email_grupo;
  }

  return (
    <UnidadesClient
      mapa={mapa}
      pendencias={pendencias}
      admin={ehAdmin(usuario.papel)}
      grupos={grupos}
    />
  );
}
