// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  Envio de e-mails da Escala — interface abstrata + modos de envio         ║
// ║   DESLIGADO (padrão): nada sai; tudo fica registrado.                     ║
// ║   TESTE: só a allowlist recebe; o resto é registrado e bloqueado.         ║
// ║   PRODUÇÃO: envio normal (só o Superadmin ativa).                         ║
// ║  Chave de idempotência: a mesma mensagem nunca sai duas vezes.            ║
// ╚══════════════════════════════════════════════════════════════════════════╝
import { db } from "@/lib/db";
import { enviarEmail } from "@/services/notificacoes";

export type Modo = "DESLIGADO" | "TESTE" | "PRODUCAO";

export interface ProvedorEmail {
  enviar(para: string, assunto: string, texto: string, html: string): Promise<{ ok: boolean; erro?: string }>;
}

/** Implementação atual: Gmail API do Workspace (mesma do resto do LocControl). */
export const provedorGmail: ProvedorEmail = {
  enviar: (para, assunto, texto, html) => enviarEmail(para, assunto, texto, undefined, html),
};

let provedor: ProvedorEmail = provedorGmail;
/** Para testes: troca o provedor por um mock. */
export function usarProvedor(p: ProvedorEmail) {
  provedor = p;
}

export interface Modos {
  modo_envio: Modo;
  modo_google: Modo;
  allowlist: string[];
  calendario_teste_id: string | null;
}

export async function lerModos(): Promise<Modos> {
  const { data, error } = await db().from("escala_global").select("*").single();
  if (error || !data) return { modo_envio: "DESLIGADO", modo_google: "DESLIGADO", allowlist: [], calendario_teste_id: null };
  return data as Modos;
}

/** Regra pura: o modo permite mandar para este destinatário? */
export function envioPermitido(modo: Modo, allowlist: readonly string[], para: string): boolean {
  if (modo === "PRODUCAO") return true;
  if (modo === "TESTE") return allowlist.map((e) => e.trim().toLowerCase()).includes(para.trim().toLowerCase());
  return false;
}

export interface Mensagem {
  chave: string;
  para: string;
  tipo: string;
  assunto: string;
  texto: string;
  html: string;
}

export type StatusEnvio = "ENVIADO" | "BLOQUEADO_MODO" | "ERRO" | "DUPLICADO";

export async function despachar(m: Mensagem, modos?: Modos): Promise<StatusEnvio> {
  const md = modos ?? (await lerModos());
  const permitido = envioPermitido(md.modo_envio, md.allowlist, m.para);

  // reserva a chave ANTES de enviar: dois processos simultâneos não mandam em dobro
  const { error: dup } = await db().from("escala_email_enviado").insert({
    chave: m.chave,
    destinatario: m.para,
    tipo: m.tipo,
    assunto: m.assunto,
    status: permitido ? "ERRO" : "BLOQUEADO_MODO",
    erro: permitido ? "enviando" : null,
    modo: md.modo_envio,
  });
  if (dup) return dup.code === "23505" ? "DUPLICADO" : "ERRO";
  if (!permitido) return "BLOQUEADO_MODO";

  const r = await provedor.enviar(m.para, m.assunto, m.texto, m.html);
  await db()
    .from("escala_email_enviado")
    .update({ status: r.ok ? "ENVIADO" : "ERRO", erro: r.ok ? null : (r.erro ?? "falha no envio") })
    .eq("chave", m.chave);
  return r.ok ? "ENVIADO" : "ERRO";
}
