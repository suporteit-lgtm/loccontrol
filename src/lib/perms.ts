import { usuarioAtual, ehAdmin, veRH, veTI } from "./session";
import type { Usuario } from "./types";

/** Garante usuário logado; lança se não houver sessão. */
export async function exigirSessao(): Promise<Usuario> {
  const u = await usuarioAtual();
  if (!u) throw new Error("Sessão expirada — entre novamente.");
  return u;
}

export async function exigirAdmin(): Promise<Usuario> {
  const u = await exigirSessao();
  if (!ehAdmin(u.papel)) throw new Error("Apenas administradores podem executar esta ação.");
  return u;
}

export async function exigirRH(): Promise<Usuario> {
  const u = await exigirSessao();
  if (!veRH(u.papel)) throw new Error("Apenas RH ou administradores podem executar esta ação.");
  return u;
}

export async function exigirTI(): Promise<Usuario> {
  const u = await exigirSessao();
  if (!veTI(u.papel)) throw new Error("Apenas TI ou administradores podem executar esta ação.");
  return u;
}

/** Só Superadmin e Admin T.I gerenciam senhas de outros usuários. */
export function ehAdminTI(papel: string): boolean {
  return papel === "Superadmin" || papel === "Admin T.I";
}

export async function exigirAdminTI(): Promise<Usuario> {
  const u = await exigirSessao();
  if (!ehAdminTI(u.papel))
    throw new Error("Apenas o Admin T.I ou o Superadmin podem gerenciar senhas de outros usuários.");
  return u;
}

export { ehAdmin, veRH, veTI };
