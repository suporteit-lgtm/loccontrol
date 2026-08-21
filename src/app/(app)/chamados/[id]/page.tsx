import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { contexto } from "@/lib/data";
import { emailSugerido, unidadeFull, dataBR } from "@/lib/format";
import { ChamadoClient } from "./ChamadoClient";
import type { Chamado, Colaborador } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ChamadoPage({ params }: { params: Promise<{ id: string }> }) {
  await contexto("ti");
  const { id } = await params;
  const { data: f } = await db().from("chamados").select("*").eq("id", id).maybeSingle();
  const ch = f as Chamado | null;
  if (!ch) notFound();
  if (!ch.colaborador_id) redirect("/fila-ti");

  const { data: cRow } = await db().from("colaboradores").select("*").eq("id", ch.colaborador_id).maybeSingle();
  const c = cRow as Colaborador | null;
  if (!c) notFound();
  if (ch.tipo === "Desligamento") redirect(`/offboarding/${c.id}`);

  const { data: matriz } = await db().from("matriz").select("ligado, obrigatorio, cargos(nome), acessos(nome, ordem)");
  const doCargo = ((matriz ?? []) as unknown as {
    ligado: boolean;
    obrigatorio: boolean;
    cargos: { nome: string };
    acessos: { nome: string; ordem: number };
  }[])
    .filter((m) => m.cargos?.nome === c.cargo && m.ligado)
    .map((m) => ({ nome: m.acessos.nome, obrig: m.obrigatorio, ordem: m.acessos.ordem }));

  // A seleção do RH manda: acesso desmarcado na pré-admissão não chega à TI.
  // c.acessos null = pré-admissão anterior a esta regra → cai na matriz do cargo.
  const acessos = (c.acessos
    ? c.acessos.map((nome) => {
        const m = doCargo.find((x) => x.nome === nome);
        return { nome, obrig: m?.obrig ?? false, ordem: m?.ordem ?? 999 };
      })
    : doCargo
  )
    .sort((a, b) => a.ordem - b.ordem)
    .map(({ nome, obrig }) => ({ nome, obrig }));

  return (
    <ChamadoClient
      chamado={{ id: ch.id, tipo: ch.tipo, slaAlvo: ch.sla_alvo, solicitante: ch.solicitante }}
      colab={{
        id: c.id,
        nome: c.nome,
        cargo: c.cargo ?? "—",
        unidade: unidadeFull(c),
        admissao: dataBR(c.admissao),
        grupos: c.grupos,
        equipamentos: c.equipamentos ?? [],
        obs: c.obs_ti,
        emailAtual: c.email,
      }}
      acessos={acessos}
      emailSugerido={c.email ?? emailSugerido(c.nome)}
    />
  );
}
