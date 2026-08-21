"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { exigirAdmin, exigirAdminTI, exigirSessao } from "@/lib/perms";
import { auditar } from "@/lib/audit";
import { primeiroNome } from "@/lib/format";
import { hashSenha, senhaValida, verificarSenha } from "@/lib/senha";
import type { Papel } from "@/lib/types";

export interface NovoUsuario {
  nome: string;
  email: string;
  papel: Papel;
  unidades: string[]; // "Cidade|Unidade"; vazio = todas
  senha: string;
}

/** Cria um usuário do sistema já aprovado (somente admins). */
export async function criarUsuario(d: NovoUsuario) {
  const adm = await exigirAdmin();
  const nome = d.nome.trim();
  const email = d.email.trim().toLowerCase();
  if (!nome) return { ok: false, msg: "Informe o nome" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, msg: "Informe um e-mail válido" };
  if (!["Admin RH", "Admin T.I", "Usuário T.I", "Usuário RH"].includes(d.papel))
    return { ok: false, msg: "Papel inválido" };
  const erroSenha = senhaValida(d.senha ?? "");
  if (erroSenha) return { ok: false, msg: erroSenha };

  const { data: existe } = await db().from("usuarios").select("id").eq("email", email).maybeSingle();
  if (existe) return { ok: false, msg: "Já existe um usuário com este e-mail" };

  const { error } = await db().from("usuarios").insert({
    nome,
    email,
    papel: d.papel,
    status: "aprovado",
    unidades_acesso: d.unidades ?? [],
    senha_hash: hashSenha(d.senha),
  });
  if (error) return { ok: false, msg: `Erro ao criar: ${error.message}` };

  await auditar({
    pessoa: nome,
    ator: adm.nome,
    tabela: "usuarios",
    campo: "registro",
    depois: `criado como ${d.papel}${d.unidades?.length ? ` · ${d.unidades.length} unidade(s)` : " · todas as unidades"}`,
  });
  revalidatePath("/usuarios");
  return {
    ok: true,
    msg: `${primeiroNome(nome)} criado como ${d.papel}${d.unidades?.length ? ` com acesso a ${d.unidades.length} unidade(s)` : ""}`,
  };
}

/** Qualquer usuário troca a PRÓPRIA senha, confirmando a atual. */
export async function trocarMinhaSenha(atual: string, nova: string) {
  const u = await exigirSessao();
  const erro = senhaValida(nova ?? "");
  if (erro) return { ok: false, msg: erro };

  const { data } = await db().from("usuarios").select("senha_hash").eq("id", u.id).maybeSingle();
  if (data?.senha_hash && !verificarSenha(atual ?? "", data.senha_hash))
    return { ok: false, msg: "Senha atual incorreta" };
  if (atual === nova) return { ok: false, msg: "A nova senha deve ser diferente da atual" };

  await db().from("usuarios").update({ senha_hash: hashSenha(nova) }).eq("id", u.id);
  await auditar({
    pessoa: u.nome,
    ator: u.nome,
    tabela: "usuarios",
    campo: "senha",
    antes: "—",
    depois: "alterada pelo próprio usuário",
  });
  return { ok: true, msg: "Sua senha foi alterada" };
}

/** Define/redefine a senha de OUTRO usuário — só Admin T.I e Superadmin. */
export async function definirSenha(id: string, senha: string) {
  const adm = await exigirAdminTI();
  const erro = senhaValida(senha ?? "");
  if (erro) return { ok: false, msg: erro };
  const { data: u } = await db().from("usuarios").select("nome, senha_hash").eq("id", id).maybeSingle();
  if (!u) return { ok: false, msg: "Usuário não encontrado" };

  await db().from("usuarios").update({ senha_hash: hashSenha(senha) }).eq("id", id);
  await auditar({
    pessoa: u.nome,
    ator: adm.nome,
    tabela: "usuarios",
    campo: "senha",
    antes: u.senha_hash ? "definida" : "—",
    depois: "redefinida",
  });
  revalidatePath("/usuarios");
  return { ok: true, msg: `Senha de ${primeiroNome(u.nome)} ${u.senha_hash ? "redefinida" : "definida"}` };
}

export async function aprovarUsuario(id: string) {
  const adm = await exigirAdmin();
  const { data: u } = await db().from("usuarios").select("nome").eq("id", id).maybeSingle();
  if (!u) return { ok: false, msg: "Usuário não encontrado" };
  await db()
    .from("usuarios")
    .update({ status: "aprovado", ultimo_acesso: new Date().toISOString() })
    .eq("id", id);
  await auditar({
    pessoa: u.nome,
    ator: adm.nome,
    tabela: "usuarios",
    campo: "login_google",
    antes: "pendente",
    depois: "aprovado",
  });
  revalidatePath("/usuarios");
  return { ok: true, msg: `Login de ${primeiroNome(u.nome)} aprovado` };
}

export async function mudarPapel(id: string, papel: Papel) {
  const adm = await exigirAdmin();
  const { data: u } = await db().from("usuarios").select("nome, papel, superadmin").eq("id", id).maybeSingle();
  if (!u) return { ok: false, msg: "Usuário não encontrado" };
  if (u.superadmin) return { ok: false, msg: "O superadmin não pode ter o papel alterado" };
  await db().from("usuarios").update({ papel }).eq("id", id);
  await auditar({
    pessoa: u.nome,
    ator: adm.nome,
    tabela: "usuarios",
    campo: "papel",
    antes: u.papel,
    depois: papel,
  });
  revalidatePath("/usuarios");
  return { ok: true, msg: `Papel de ${primeiroNome(u.nome)} alterado para ${papel}` };
}

/** Define quais unidades o usuário pode acessar (lista vazia = todas). */
export async function salvarUnidadesAcesso(id: string, unidades: string[]) {
  const adm = await exigirAdmin();
  const { data: u } = await db()
    .from("usuarios")
    .select("nome, superadmin, unidades_acesso")
    .eq("id", id)
    .maybeSingle();
  if (!u) return { ok: false, msg: "Usuário não encontrado" };
  if (u.superadmin) return { ok: false, msg: "O superadmin sempre vê todas as unidades" };

  await db().from("usuarios").update({ unidades_acesso: unidades }).eq("id", id);
  await auditar({
    pessoa: u.nome,
    ator: adm.nome,
    tabela: "usuarios",
    campo: "unidades_acesso",
    antes: (u.unidades_acesso ?? []).length ? `${u.unidades_acesso.length} unidade(s)` : "todas",
    depois: unidades.length ? `${unidades.length} unidade(s)` : "todas",
  });
  revalidatePath("/usuarios");
  return {
    ok: true,
    msg: unidades.length
      ? `${primeiroNome(u.nome)} agora acessa ${unidades.length} unidade(s)`
      : `${primeiroNome(u.nome)} agora acessa todas as unidades`,
  };
}

export async function removerUsuario(id: string) {
  const adm = await exigirAdmin();
  const { data: u } = await db().from("usuarios").select("nome, superadmin").eq("id", id).maybeSingle();
  if (!u) return { ok: false, msg: "Usuário não encontrado" };
  if (u.superadmin) return { ok: false, msg: "O superadmin permanente não pode ser removido" };
  await db().from("usuarios").delete().eq("id", id);
  await auditar({ pessoa: u.nome, ator: adm.nome, tabela: "usuarios", campo: "registro", antes: "ativo", depois: "removido" });
  revalidatePath("/usuarios");
  return { ok: true, msg: `${primeiroNome(u.nome)} removido · precisará solicitar acesso de novo` };
}
