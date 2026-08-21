import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { contexto, colaborador, unidadesMap } from "@/lib/data";
import { unidadeFull } from "@/lib/format";
import { PerfilClient } from "./PerfilClient";
import type { Auditoria, Chamado, Documento, Evento } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PerfilPage({ params }: { params: Promise<{ id: string }> }) {
  const { usuario } = await contexto();
  const { id } = await params;
  const c = await colaborador(id);
  if (!c) notFound();

  const [{ data: docs }, { data: eventos }, { data: chamados }, { data: hist }, { data: matriz }, mapa, { data: cargosDb }] =
    await Promise.all([
      db().from("documentos").select("*").eq("colaborador_id", id).order("assinado_em"),
      db().from("eventos").select("*").eq("colaborador_id", id).order("quando"),
      db().from("chamados").select("*").eq("colaborador_id", id).is("concluido_em", null),
      db().from("auditoria").select("*").eq("pessoa", c.nome).order("quando", { ascending: false }),
      db().from("matriz").select("ligado, obrigatorio, cargos(nome), acessos(nome, ordem)"),
      unidadesMap(),
      db().from("cargos").select("nome").order("nome"),
    ]);

  // analistas de TI para atribuir o desligamento (mesma régua do wizard)
  const { data: tiUsers } = await db().from("usuarios").select("nome, papel").eq("status", "aprovado");
  const analistas = (tiUsers ?? [])
    .filter((t) => t.papel.includes("T.I"))
    .map((t) => t.nome)
    .sort((a, b) => a.localeCompare(b));

  const acessosDoCargo = ((matriz ?? []) as unknown as {
    ligado: boolean;
    cargos: { nome: string };
    acessos: { nome: string; ordem: number };
  }[])
    .filter((m) => m.cargos?.nome === c.cargo && m.ligado)
    .sort((a, b) => a.acessos.ordem - b.acessos.ordem)
    .map((m) => m.acessos.nome);

  return (
    <PerfilClient
      colab={c}
      unidade={unidadeFull(c)}
      docs={(docs ?? []) as Documento[]}
      eventos={(eventos ?? []) as Evento[]}
      chamado={((chamados ?? []) as Chamado[])[0] ?? null}
      hist={(hist ?? []) as Auditoria[]}
      acessosDoCargo={acessosDoCargo}
      papel={usuario.papel}
      unidadesMap={mapa}
      cargos={(cargosDb ?? []).map((c) => c.nome)}
      analistas={analistas}
    />
  );
}
