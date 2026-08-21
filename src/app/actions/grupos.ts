"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { exigirSessao, ehAdmin } from "@/lib/perms";
import { auditar } from "@/lib/audit";
import { proximoChamadoId, arquivarChamado } from "@/lib/data";
import { emitir } from "@/lib/notificar";
import { abrirTicket } from "@/services/tickets";
import * as workspace from "@/services/googleWorkspace";

function podeExcluirDireto(papel: string) {
  // Regra central: Usuário T.I é o único não-admin que exclui grupos direto
  return papel === "Superadmin" || papel.startsWith("Admin") || papel === "Usuário T.I";
}

export async function solicitarCriacaoGrupo(nome: string, email: string) {
  const u = await exigirSessao();
  if (!nome.trim() || !email.includes("@")) return { ok: false, msg: "Informe nome e e-mail do grupo" };
  const { data: existe } = await db().from("grupos_workspace").select("id").eq("email", email).maybeSingle();
  if (existe) return { ok: false, msg: "Já existe um grupo com este e-mail" };

  const id = await proximoChamadoId();
  await db().from("chamados").insert({
    id,
    tipo: "Criação de grupo",
    silenciado: false,
    payload: { gTipo: "criacao", nome: nome.trim(), email: email.trim().toLowerCase() },
    solicitante: u.nome,
  });
  await emitir(
    "grupos",
    "admins",
    `Criação de grupo solicitada: ${email.trim().toLowerCase()}`,
    `${u.nome} pediu a criação do grupo "${nome.trim()}". Chamado ${id} na Fila da TI.`,
    id
  );
  await abrirTicket({
    ref: id,
    tipo: "solicitacao",
    titulo: `Criação de grupo: ${email.trim().toLowerCase()}`,
    descricao: `Grupo "${nome.trim()}" solicitado por ${u.nome} no LOCCONTROL.`,
    solicitanteEmail: u.email,
  });
  revalidatePath("/grupos");
  revalidatePath("/fila-ti");
  return { ok: true, msg: `Chamado ${id} aberto para a TI` };
}

export async function excluirOuSolicitarGrupo(email: string) {
  const u = await exigirSessao();
  const { data: g } = await db().from("grupos_workspace").select("*").eq("email", email).maybeSingle();
  if (!g) return { ok: false, msg: "Grupo não encontrado" };

  if (podeExcluirDireto(u.papel)) {
    const r = await workspace.excluirGrupo(email);
    if (!r.ok) return { ok: false, msg: `Workspace: ${r.erro}` };
    await db().from("grupos_workspace").delete().eq("email", email);
    // limpa solicitações de exclusão pendentes deste grupo
    const { data: pend } = await db().from("chamados").select("id, payload").not("payload", "is", null);
    for (const p of pend ?? []) {
      const pl = p.payload as { gTipo?: string; email?: string } | null;
      if (pl?.gTipo === "exclusao" && pl.email === email) await arquivarChamado(p.id, "concluido", u.nome);
    }
    await auditar({ ator: u.nome, tabela: "grupos", campo: email, antes: "ativo", depois: "excluído" });
    await emitir("grupos", "admins", `Grupo excluído: ${email}`, `Excluído do Workspace por ${u.nome}.`);
    revalidatePath("/grupos");
    revalidatePath("/fila-ti");
    return { ok: true, msg: `Grupo ${email} excluído` };
  }

  const { data: pend } = await db().from("chamados").select("id, payload").not("payload", "is", null);
  const ja = (pend ?? []).some((p) => {
    const pl = p.payload as { gTipo?: string; email?: string } | null;
    return pl?.gTipo === "exclusao" && pl.email === email;
  });
  if (ja) return { ok: false, msg: "Já existe pedido de exclusão para este grupo" };

  const id = await proximoChamadoId();
  await db().from("chamados").insert({
    id,
    tipo: "Exclusão de grupo",
    silenciado: false,
    payload: { gTipo: "exclusao", nome: g.nome, email },
    solicitante: u.nome,
  });
  revalidatePath("/grupos");
  revalidatePath("/fila-ti");
  return { ok: true, msg: `Chamado ${id} aberto para a TI` };
}

export async function adicionarMembroGrupo(grupoEmail: string, email: string) {
  const u = await exigirSessao();
  const em = email.trim().toLowerCase();
  if (!em.includes("@")) return { ok: false, msg: "Informe um e-mail válido" };

  const { data: c } = await db().from("colaboradores").select("id, nome, grupos").eq("email", em).maybeSingle();
  if (c) {
    if ((c.grupos ?? []).includes(grupoEmail)) return { ok: false, msg: "Este e-mail já está no grupo" };
    const r = await workspace.adicionarMembro(grupoEmail, em);
    if (!r.ok) return { ok: false, msg: `Workspace: ${r.erro}` };
    await db()
      .from("colaboradores")
      .update({ grupos: [...(c.grupos ?? []), grupoEmail] })
      .eq("id", c.id);
    await auditar({ pessoa: c.nome, ator: u.nome, tabela: "grupos", campo: grupoEmail, depois: "incluído" });
  } else {
    const { data: existe } = await db()
      .from("grupo_membros_externos")
      .select("id")
      .eq("grupo_email", grupoEmail)
      .eq("email", em)
      .maybeSingle();
    if (existe) return { ok: false, msg: "Este e-mail já está no grupo" };
    const r = await workspace.adicionarMembro(grupoEmail, em);
    if (!r.ok) return { ok: false, msg: `Workspace: ${r.erro}` };
    const nome = em
      .split("@")[0]
      .split(".")
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" ");
    await db().from("grupo_membros_externos").insert({ grupo_email: grupoEmail, nome, email: em });
    await auditar({ pessoa: nome, ator: u.nome, tabela: "grupos", campo: grupoEmail, depois: "incluído" });
  }
  revalidatePath("/grupos");
  return { ok: true, msg: `${em} adicionado a ${grupoEmail} · aplicado no Workspace` };
}

export async function removerMembrosGrupo(grupoEmail: string, emails: string[]) {
  const u = await exigirSessao();
  if (!emails.length) return { ok: false, msg: "Nenhum membro selecionado" };
  const rw = await workspace.removerMembros(grupoEmail, emails);
  if (!rw.ok) return { ok: false, msg: `Workspace: ${rw.erro}` };

  const { data: colabs } = await db().from("colaboradores").select("id, grupos, email").in("email", emails);
  for (const c of colabs ?? []) {
    await db()
      .from("colaboradores")
      .update({ grupos: (c.grupos ?? []).filter((g: string) => g !== grupoEmail) })
      .eq("id", c.id);
  }
  await db().from("grupo_membros_externos").delete().eq("grupo_email", grupoEmail).in("email", emails);

  await auditar({
    ator: u.nome,
    tabela: "grupos",
    campo: grupoEmail,
    antes: `${emails.length} membro(s)`,
    depois: "removido(s)",
  });
  revalidatePath("/grupos");
  return { ok: true, msg: `${emails.length} membro(s) removido(s) de ${grupoEmail} · aplicado no Workspace` };
}

// A sincronização com o Workspace é automática (ver src/app/actions/sync.ts,
// disparada a cada 30s pelo componente AutoSync) — não há mais botão manual.
