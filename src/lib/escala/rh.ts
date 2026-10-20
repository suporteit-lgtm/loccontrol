// Leituras das telas do RH (dentro do LocControl). Servidor apenas (service_role).
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { contexto } from "@/lib/data";
import { escalaHabilitada } from "./auth";
import type { ConfigEscala } from "./servico";

/** Página do RH: exige perfil RH/Admin e o módulo liberado. */
export async function contextoEscalaRH() {
  if (!escalaHabilitada()) notFound();
  return contexto("rh");
}

export interface UnidadeEscala {
  config: ConfigEscala;
  cidade: string;
  unidade: string;
  grupos: { id: string; letra: "A" | "B"; email_workspace: string | null; email_teste: string | null }[];
}

/** Hoje só BH · Centro tem escala; a estrutura aceita outras unidades no futuro. */
export async function unidadeDaEscala(): Promise<UnidadeEscala> {
  const { data, error } = await db()
    .from("escala_config")
    .select("*, unidades(nome, cidades(nome))")
    .limit(1)
    .single();
  if (error || !data) throw new Error("Escala não configurada: " + (error?.message ?? "sem unidade"));
  const u = data.unidades as unknown as { nome: string; cidades: { nome: string } };
  const { data: grupos } = await db()
    .from("escala_grupo")
    .select("id, letra, email_workspace, email_teste")
    .eq("unidade_id", data.unidade_id)
    .order("letra");
  return {
    config: data as unknown as ConfigEscala,
    cidade: u.cidades.nome,
    unidade: u.nome,
    grupos: (grupos ?? []) as UnidadeEscala["grupos"],
  };
}

export interface ParticipanteRH {
  id: string;
  colaboradorId: string;
  nome: string;
  email: string | null;
  cargo: string;
  cidade: string;
  unidade: string;
  status: string; // status do colaborador no LocControl
  grupo: "A" | "B";
  ativo: boolean;
  vinculado: boolean; // já entrou no portal com o Google
}

export async function participantes(unidadeId: string): Promise<ParticipanteRH[]> {
  const { data } = await db()
    .from("escala_participante")
    .select("id, ativo, auth_user_id, colaborador_id, escala_grupo!inner(letra, unidade_id), colaboradores(nome, email, cargo, cidade, unidade, status)")
    .eq("escala_grupo.unidade_id", unidadeId);
  return (data ?? [])
    .map((p) => {
      const c = p.colaboradores as unknown as { nome: string; email: string | null; cargo: string; cidade: string; unidade: string; status: string };
      const g = p.escala_grupo as unknown as { letra: "A" | "B" };
      return {
        id: p.id,
        colaboradorId: p.colaborador_id,
        nome: c.nome,
        email: c.email,
        cargo: c.cargo,
        cidade: c.cidade,
        unidade: c.unidade,
        status: c.status,
        grupo: g.letra,
        ativo: p.ativo,
        vinculado: !!p.auth_user_id,
      };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome));
}

export interface Candidato {
  id: string;
  nome: string;
  cargo: string;
  cidade: string;
  unidade: string;
  status: string;
  email: string | null;
}

/** Colaboradores que podem entrar na escala (todos menos desligados e quem já participa). */
export async function candidatos(jaParticipam: Set<string>): Promise<Candidato[]> {
  const { data } = await db()
    .from("colaboradores")
    .select("id, nome, cargo, cidade, unidade, status, email")
    .neq("status", "Desligado")
    .order("nome");
  return ((data ?? []) as Candidato[]).filter((c) => !jaParticipam.has(c.id));
}
