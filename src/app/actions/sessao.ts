"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { verificarSenha } from "@/lib/senha";
import {
  setSessionCookie,
  clearSessionCookie,
  setUnidadeCookie,
  usuarioAtual,
  TODAS,
} from "@/lib/session";
import type { Papel } from "@/lib/types";

/**
 * Login por e-mail e senha do usuário cadastrado em Usuários.
 * (SSO Google do domínio segue no roadmap como evolução.)
 */
export async function entrarComEmail(
  email: string,
  senha: string
): Promise<{ ok: false; msg: string } | never> {
  const em = email.trim().toLowerCase();
  if (!em.includes("@") || !senha) return { ok: false, msg: "Informe e-mail e senha" };

  const { data: u } = await db().from("usuarios").select("*").eq("email", em).maybeSingle();
  // mensagens deliberadamente iguais: não revelar quais e-mails existem
  if (!u || u.status !== "aprovado") return { ok: false, msg: "E-mail ou senha incorretos" };
  if (!u.senha_hash)
    return { ok: false, msg: "Este usuário ainda não tem senha — peça a um administrador para definir em Usuários" };
  if (!verificarSenha(senha, u.senha_hash)) return { ok: false, msg: "E-mail ou senha incorretos" };

  await db().from("usuarios").update({ ultimo_acesso: new Date().toISOString() }).eq("id", u.id);
  await setSessionCookie(u.id);
  redirect((u.papel as Papel).includes("T.I") ? "/dash-ti" : "/dash");
}

export async function sair() {
  await clearSessionCookie();
  redirect("/login");
}

export async function mudarUnidade(cidade: string, unidade: string) {
  const u = await usuarioAtual();
  if (!u) redirect("/login");
  await setUnidadeCookie({ cidade, unidade: unidade || TODAS });
}
