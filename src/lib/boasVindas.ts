import { db } from "./db";
import { primeiroNome } from "./format";
import { enviarEmail } from "@/services/notificacoes";
import type { Colaborador } from "./types";

/** Modelos disponíveis em `modelos_email`. */
export type ChaveModelo = "boas-vindas" | "acesso-quark" | "credenciais" | "credenciais-externo";

/** Minutos entre o primeiro login e os e-mails do corporativo. */
export const ATRASO_POS_LOGIN_MIN = 5;

/**
 * Envia um modelo de e-mail (texto + anexo opcional) já com os placeholders
 * preenchidos. Melhor-esforço: o erro é devolvido, nunca lançado.
 */
export async function enviarModelo(
  chave: ChaveModelo,
  c: Pick<Colaborador, "nome" | "cargo" | "cidade" | "unidade">,
  para: string,
  extras: Record<string, string> = {}
): Promise<{ ok: boolean; erro?: string }> {
  const { data: m } = await db()
    .from("modelos_email")
    .select("assunto, corpo, anexo_nome, anexo_b64")
    .eq("chave", chave)
    .maybeSingle();
  if (!m) return { ok: false, erro: `modelo ${chave} não encontrado` };

  const valores: Record<string, string> = {
    nome: c.nome,
    primeiro_nome: primeiroNome(c.nome),
    email: para,
    cargo: c.cargo ?? "—",
    unidade: [c.cidade, c.unidade].filter(Boolean).join(" · ") || "—",
    ...extras,
  };
  const preencher = (t: string) =>
    t.replace(/\{(\w+)\}/g, (todo, k: string) => valores[k] ?? todo);

  return enviarEmail(
    para,
    preencher(m.assunto),
    preencher(m.corpo),
    m.anexo_nome && m.anexo_b64 ? { nome: m.anexo_nome, b64: m.anexo_b64 } : undefined
  );
}

/** Compatibilidade: boas-vindas continua sendo o modelo de chamados. */
export async function enviarBoasVindas(c: Colaborador, email: string) {
  return enviarModelo("boas-vindas", c, email);
}

/**
 * Programa um e-mail. A chave (colaborador, modelo) é única no banco, então
 * chamar duas vezes não duplica — a segunda simplesmente não insere.
 */
export async function agendarEnvio(
  colaboradorId: string,
  modelo: ChaveModelo,
  para: string,
  minutos: number
): Promise<boolean> {
  const quando = new Date(Date.now() + minutos * 60_000).toISOString();
  const { error } = await db()
    .from("envios_agendados")
    .insert({ colaborador_id: colaboradorId, modelo, para, enviar_em: quando });
  return !error;
}
