"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { exigirSessao } from "@/lib/perms";
import { auditar } from "@/lib/audit";
import { primeiroNome } from "@/lib/format";
import { notificarConclusao } from "@/services/tickets";
import { arquivarChamado } from "@/lib/data";

export async function alternarItemChecklist(itemId: string) {
  const u = await exigirSessao();
  const { data: item } = await db().from("checklist_itens").select("*").eq("id", itemId).maybeSingle();
  if (!item) return { ok: false, msg: "Item não encontrado" };
  if (item.done) {
    await db().from("checklist_itens").update({ done: false, por: null, quando: null }).eq("id", itemId);
  } else {
    await db()
      .from("checklist_itens")
      .update({ done: true, por: u.nome, quando: new Date().toISOString() })
      .eq("id", itemId);
  }
  revalidatePath(`/offboarding/${item.colaborador_id}`);
  revalidatePath("/fila-rh");
  return { ok: true, msg: "" };
}

export async function salvarObsChecklist(itemId: string, obs: string) {
  await exigirSessao();
  const { data: item } = await db().from("checklist_itens").select("colaborador_id").eq("id", itemId).maybeSingle();
  await db().from("checklist_itens").update({ obs: obs.trim() || null }).eq("id", itemId);
  if (item) revalidatePath(`/offboarding/${item.colaborador_id}`);
  return { ok: true, msg: "" };
}

export async function concluirOffboarding(colabId: string) {
  const u = await exigirSessao();
  const [{ data: c }, { data: itens }] = await Promise.all([
    db().from("colaboradores").select("nome").eq("id", colabId).maybeSingle(),
    db().from("checklist_itens").select("done").eq("colaborador_id", colabId),
  ]);
  if (!c) return { ok: false as const, msg: "Colaborador não encontrado" };
  if (!(itens ?? []).length || !(itens ?? []).every((i) => i.done))
    return { ok: false as const, msg: "Conclua todos os itens de RH e TI antes de encerrar" };

  const { data: chamados } = await db()
    .from("chamados")
    .select("id, tipo")
    .eq("colaborador_id", colabId)
    .is("concluido_em", null);
  for (const f of (chamados ?? []).filter((x) => x.tipo === "Desligamento")) {
    await arquivarChamado(f.id, "concluido", u.nome);
    await notificarConclusao(f.id);
  }

  await db().from("eventos").insert({
    colaborador_id: colabId,
    fase: "desligado",
    ator: `${u.nome}`,
    descricao: "Offboarding concluído · chamado encerrado",
  });
  await auditar({
    pessoa: c.nome,
    ator: u.nome,
    tabela: "chamados",
    campo: "offboarding",
    antes: "em andamento",
    depois: "concluído",
  });

  revalidatePath("/fila-ti");
  revalidatePath("/fila-rh");
  return { ok: true as const, msg: `Offboarding de ${primeiroNome(c.nome)} concluído` };
}
