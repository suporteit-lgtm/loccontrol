"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { exigirSessao, exigirAdmin } from "@/lib/perms";
import { auditar } from "@/lib/audit";
import { enviarTeste } from "@/services/notificacoes";

export async function alternarNotif(chave: string) {
  const u = await exigirSessao();
  const notif = { ...(u.notif ?? {}), [chave]: !u.notif?.[chave] };
  await db().from("usuarios").update({ notif }).eq("id", u.id);
  revalidatePath("/configuracoes");
  return { ok: true, msg: "" };
}

export async function enviarNotifTeste() {
  const u = await exigirSessao();
  const r = await enviarTeste(u.email);
  return r.ok
    ? { ok: true, msg: `Notificação de teste enviada para ${u.email}` }
    : { ok: false, msg: `Falha no envio: ${r.erro}` };
}

export interface ItemTemplate {
  lista: "rh" | "ti";
  titulo: string;
}

export interface ItemEquipamento {
  nome: string;
  kit: boolean;
}

/** Substitui o catálogo de equipamentos (somente admins). */
export async function salvarEquipamentos(itens: ItemEquipamento[]) {
  const adm = await exigirAdmin();
  const vistos = new Set<string>();
  const validos = itens
    .map((i) => ({ ...i, nome: i.nome.trim() }))
    .filter((i) => i.nome && !vistos.has(i.nome.toLowerCase()) && (vistos.add(i.nome.toLowerCase()), true));
  if (!validos.length) return { ok: false, msg: "Informe ao menos um equipamento" };

  await db().from("equipamentos_catalogo").delete().neq("nome", "");
  const { error } = await db()
    .from("equipamentos_catalogo")
    .insert(validos.map((i, ix) => ({ nome: i.nome, kit: i.kit, ordem: ix + 1 })));
  if (error) return { ok: false, msg: `Erro ao salvar: ${error.message}` };

  await auditar({
    ator: adm.nome,
    tabela: "configuracoes",
    campo: "equipamentos",
    depois: `${validos.length} item(ns), kit com ${validos.filter((i) => i.kit).length}`,
  });
  revalidatePath("/configuracoes");
  revalidatePath("/pre-admissao");
  return { ok: true, msg: "Catálogo de equipamentos atualizado" };
}

/** Salva um modelo de e-mail (somente admins). */
export async function salvarModeloEmail(chave: string, assunto: string, corpo: string) {
  const adm = await exigirAdmin();
  const a = assunto.trim();
  const c = corpo.trim();
  if (!a || !c) return { ok: false, msg: "Assunto e corpo não podem ficar vazios" };

  const { error } = await db()
    .from("modelos_email")
    .update({ assunto: a, corpo: c, atualizado_em: new Date().toISOString() })
    .eq("chave", chave);
  if (error) return { ok: false, msg: `Erro ao salvar: ${error.message}` };

  await auditar({ ator: adm.nome, tabela: "configuracoes", campo: `modelo_${chave}`, depois: a });
  revalidatePath("/configuracoes");
  return { ok: true, msg: "Modelo de e-mail atualizado" };
}

/** Substitui o template do checklist de offboarding (somente admins). */
export async function salvarTemplateChecklist(itens: ItemTemplate[]) {
  const adm = await exigirAdmin();
  const validos = itens.map((i) => ({ ...i, titulo: i.titulo.trim() })).filter((i) => i.titulo);
  if (!validos.some((i) => i.lista === "rh") || !validos.some((i) => i.lista === "ti"))
    return { ok: false, msg: "As duas listas (RH e TI) precisam de ao menos um item" };

  const linhas = ["rh", "ti"].flatMap((lista) =>
    validos.filter((i) => i.lista === lista).map((i, ix) => ({ lista, ordem: ix + 1, titulo: i.titulo }))
  );

  await db().from("checklist_templates").delete().neq("titulo", "");
  const { error } = await db().from("checklist_templates").insert(linhas);
  if (error) return { ok: false, msg: `Erro ao salvar: ${error.message}` };

  await auditar({
    ator: adm.nome,
    tabela: "configuracoes",
    campo: "template_offboarding",
    depois: `${linhas.filter((l) => l.lista === "rh").length} RH + ${linhas.filter((l) => l.lista === "ti").length} TI`,
  });
  revalidatePath("/configuracoes");
  return { ok: true, msg: "Template do checklist atualizado" };
}
