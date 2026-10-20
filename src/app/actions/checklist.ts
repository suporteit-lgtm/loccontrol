"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { exigirSessao, exigirTI } from "@/lib/perms";
import { auditar } from "@/lib/audit";
import { primeiroNome } from "@/lib/format";
import { notificarConclusao, atualizarTicket } from "@/services/tickets";
import { arquivarChamado } from "@/lib/data";
import { emitir } from "@/lib/notificar";

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

/**
 * A TI terminou a parte DELA no offboarding: o chamado sai da fila da TI
 * (ti_concluido), mas continua vivo para o RH até o checklist completo —
 * mesmo efeito do webhook "concluido" da ferramenta de chamados.
 */
export async function concluirParteTIOffboarding(colabId: string) {
  const u = await exigirTI();
  const [{ data: c }, { data: itensTI }] = await Promise.all([
    db().from("colaboradores").select("nome, cidade, unidade").eq("id", colabId).maybeSingle(),
    db().from("checklist_itens").select("done").eq("colaborador_id", colabId).eq("lista", "ti"),
  ]);
  if (!c) return { ok: false as const, msg: "Colaborador não encontrado" };
  if (!(itensTI ?? []).length || !(itensTI ?? []).every((i) => i.done))
    return { ok: false as const, msg: "Conclua todos os itens da TI antes de encerrar a sua parte" };

  const { data: abertos } = await db()
    .from("chamados")
    .select("id, ti_concluido, solicitante")
    .eq("colaborador_id", colabId)
    .eq("tipo", "Desligamento")
    .is("concluido_em", null);
  const pendentes = (abertos ?? []).filter((f) => !f.ti_concluido);
  if (!pendentes.length)
    return { ok: false as const, msg: "A parte da TI deste chamado já está concluída" };

  const unidadeRef = c.cidade && c.unidade ? `${c.cidade}|${c.unidade}` : null;
  for (const f of pendentes) {
    await db().from("chamados").update({ ti_concluido: true, silenciado: false }).eq("id", f.id);
    await atualizarTicket(f.id, "concluido", `Parte da TI concluída por ${u.nome} no LOCCONTROL`);
    // avisa quem abriu o desligamento: agora é com o RH
    const { data: quemAbriu } = f.solicitante
      ? await db().from("usuarios").select("email").eq("nome", f.solicitante).maybeSingle()
      : { data: null };
    await emitir(
      "chamado",
      "rh",
      `TI concluiu o desligamento de ${c.nome}`,
      `Chamado ${f.id} finalizado pela TI (${u.nome}). Falta a parte do RH no offboarding.`,
      `${f.id}:ti-ok`,
      quemAbriu?.email ?? null,
      undefined,
      unidadeRef
    );
  }

  await db().from("eventos").insert({
    colaborador_id: colabId,
    fase: "desligado",
    ator: `${u.nome} · TI`,
    descricao: "Parte da TI do offboarding concluída · chamado saiu da fila da TI",
  });
  await auditar({
    pessoa: c.nome,
    ator: u.nome,
    tabela: "chamados",
    campo: "offboarding",
    antes: "na fila da TI",
    depois: "parte da TI concluída · aguardando o RH",
  });

  revalidatePath("/fila-ti");
  revalidatePath("/fila-rh");
  revalidatePath(`/offboarding/${colabId}`);
  return { ok: true as const, msg: `Sua parte no offboarding de ${primeiroNome(c.nome)} foi concluída` };
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
