// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  Escala de Presença — login Google do portal (Supabase Auth)              ║
// ║                                                                          ║
// ║  O LocControl continua com o login próprio (cookie lc_sessao). O portal   ║
// ║  /escala usa o Supabase Auth com Google, restrito a @locgrupo.com.br.     ║
// ║  O PERFIL decide o acesso: quem não é usuário interno recebe só           ║
// ║  COLABORADOR_ESCALA (gravado em app_metadata, que o usuário não altera).  ║
// ╚══════════════════════════════════════════════════════════════════════════╝
import { cookies } from "next/headers";
import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { db } from "@/lib/db";

export const DOMINIO = "locgrupo.com.br";
export type PerfilPortal = "COLABORADOR_ESCALA" | "INTERNO";

export function escalaHabilitada(): boolean {
  return process.env.ESCALA_HABILITADA === "1";
}

export function emailDoDominio(email: string | null | undefined): boolean {
  return !!email && email.trim().toLowerCase().endsWith("@" + DOMINIO);
}

/** Cliente Supabase com a chave pública e a sessão do portal (cookies sb-*). */
export async function supabasePortal() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !chave) throw new Error("Defina NEXT_PUBLIC_SUPABASE_ANON_KEY no .env para o login Google do portal.");
  const jar = await cookies();
  return createServerClient(url, chave, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (lista) => {
        try {
          for (const { name, value, options } of lista) jar.set(name, value, options);
        } catch {
          // Server Component não grava cookie — o middleware renova a sessão.
        }
      },
    },
  });
}

export interface ParticipantePortal {
  id: string;
  ativo: boolean;
  grupo: "A" | "B";
  unidadeId: string;
  colaboradorId: string;
  nome: string;
  statusColaborador: string;
}

export interface ContaPortal {
  authId: string;
  email: string;
  nome: string;
  perfil: PerfilPortal;
  participante: ParticipantePortal | null;
  /** false enquanto as migrations da escala não foram aplicadas */
  escalaInstalada: boolean;
}

/** Participante vinculado à conta Google (pelo auth_user_id gravado no login). */
async function participanteDe(authId: string): Promise<{ p: ParticipantePortal | null; instalada: boolean }> {
  const { data, error } = await db()
    .from("escala_participante")
    .select("id, ativo, colaborador_id, escala_grupo(letra, unidade_id), colaboradores(nome, status)")
    .eq("auth_user_id", authId)
    .maybeSingle();
  if (error) return { p: null, instalada: !/escala_participante|relation|schema cache/i.test(error.message) };
  if (!data) return { p: null, instalada: true };
  const g = data.escala_grupo as unknown as { letra: "A" | "B"; unidade_id: string };
  const c = data.colaboradores as unknown as { nome: string; status: string };
  return {
    instalada: true,
    p: {
      id: data.id,
      ativo: data.ativo,
      grupo: g.letra,
      unidadeId: g.unidade_id,
      colaboradorId: data.colaborador_id,
      nome: c.nome,
      statusColaborador: c.status,
    },
  };
}

/** Conta logada no portal (ou null). Valida o token com o Supabase a cada request. */
export const contaPortal = cache(async (): Promise<ContaPortal | null> => {
  const sb = await supabasePortal();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user?.email || !emailDoDominio(user.email)) return null;
  const perfil = (user.app_metadata?.perfil as PerfilPortal | undefined) ?? "COLABORADOR_ESCALA";
  let { p, instalada } = await participanteDe(user.id);
  // incluído na escala depois do login: vincula agora pelo e-mail corporativo
  if (!p && instalada && (await vincularParticipante(user.id, user.email))) ({ p, instalada } = await participanteDe(user.id));
  return {
    authId: user.id,
    email: user.email.toLowerCase(),
    nome: p?.nome ?? (user.user_metadata?.full_name as string) ?? user.email,
    perfil,
    participante: p,
    escalaInstalada: instalada,
  };
});

/**
 * Pós-login: define o perfil e vincula a conta ao participante pelo e-mail
 * corporativo do cadastro de colaboradores. Devolve o id do usuário interno
 * (se houver) para o callback abrir também a sessão do LocControl.
 */
export async function vincularConta(authId: string, email: string): Promise<{ usuarioInternoId: string | null }> {
  const em = email.trim().toLowerCase();
  const { data: interno } = await db()
    .from("usuarios")
    .select("id, status")
    .eq("email", em)
    .maybeSingle();
  const usuarioInternoId = interno?.status === "aprovado" ? (interno.id as string) : null;

  await db().auth.admin.updateUserById(authId, {
    app_metadata: { perfil: usuarioInternoId ? "INTERNO" : "COLABORADOR_ESCALA" },
  });

  await vincularParticipante(authId, em);
  return { usuarioInternoId };
}

/** Liga a conta Google ao participante cujo colaborador tem este e-mail corporativo. */
async function vincularParticipante(authId: string, email: string): Promise<boolean> {
  const { data: colab } = await db().from("colaboradores").select("id").eq("email", email.trim().toLowerCase()).maybeSingle();
  if (!colab) return false;
  const { data } = await db()
    .from("escala_participante")
    .update({ auth_user_id: authId })
    .eq("colaborador_id", colab.id)
    .or(`auth_user_id.is.null,auth_user_id.neq.${authId}`)
    .select("id");
  return !!data?.length;
}
