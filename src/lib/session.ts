import { cookies } from "next/headers";
import { cache } from "react";
import { createHmac } from "node:crypto";
import { db } from "./db";
import type { Papel, Usuario } from "./types";

const COOKIE = "lc_sessao";
const UNIDADE_COOKIE = "lc_unidade";

function secret() {
  return process.env.SESSION_SECRET || "loccontrol-demo-secret";
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function encodeSession(userId: string): string {
  const payload = Buffer.from(JSON.stringify({ id: userId })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function decodeSession(value: string | undefined): string | null {
  if (!value) return null;
  const [payload, sig] = value.split(".");
  if (!payload || !sig || sign(payload) !== sig) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString()).id ?? null;
  } catch {
    return null;
  }
}

export async function setSessionCookie(userId: string) {
  const jar = await cookies();
  jar.set(COOKIE, encodeSession(userId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

/** Usuário logado (ou null). Relido do banco a cada request (papel pode mudar),
 *  mas deduplicado dentro do mesmo request via React cache — layout e página
 *  compartilham a mesma consulta. */
export const usuarioAtual = cache(async (): Promise<Usuario | null> => {
  const jar = await cookies();
  const id = decodeSession(jar.get(COOKIE)?.value);
  if (!id) return null;
  const { data } = await db().from("usuarios").select("*").eq("id", id).maybeSingle();
  if (!data || data.status !== "aprovado") return null;
  return data as Usuario;
});

// ── Filtro "Minha unidade" (persistido em cookie) ────────────────────────────
export const TODAS = "Todas as unidades";
/** Opção do seletor de cidade que mostra o grupo inteiro, todas as bases. */
export const TODAS_CIDADES = "Todas as cidades";

export interface UnidadeFiltro {
  cidade: string;
  unidade: string; // TODAS ou nome da unidade
}

export async function unidadeAtual(): Promise<UnidadeFiltro> {
  const jar = await cookies();
  try {
    const raw = jar.get(UNIDADE_COOKIE)?.value;
    if (raw) {
      const v = JSON.parse(raw);
      if (v.cidade && v.unidade) return v;
    }
  } catch {}
  return { cidade: "Rio de Janeiro", unidade: TODAS };
}

export async function setUnidadeCookie(f: UnidadeFiltro) {
  const jar = await cookies();
  jar.set(UNIDADE_COOKIE, JSON.stringify(f), { path: "/", maxAge: 60 * 60 * 24 * 365 });
}

// ── Papéis ───────────────────────────────────────────────────────────────────
export function ehAdmin(papel: Papel) {
  return papel === "Superadmin" || papel.startsWith("Admin");
}
export function veRH(papel: Papel) {
  return ehAdmin(papel) || papel === "Usuário RH";
}
export function veTI(papel: Papel) {
  return ehAdmin(papel) || papel === "Usuário T.I";
}
