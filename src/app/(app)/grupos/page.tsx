import { db } from "@/lib/db";
import { contexto, chamadosAbertos } from "@/lib/data";
import { quandoBR } from "@/lib/format";
import { ultimaSync } from "@/app/actions/sync";
import { GruposClient, type GrupoView } from "./GruposClient";
import type { Colaborador, GrupoWorkspace, MembroExterno } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function GruposPage() {
  const { usuario } = await contexto();
  const [{ data: grupos }, { data: colabs }, { data: externos }, chamados, sync] = await Promise.all([
    db().from("grupos_workspace").select("*").order("nome"),
    db().from("colaboradores").select("id, nome, email, status, grupos, bloqueado"),
    db().from("grupo_membros_externos").select("*"),
    chamadosAbertos(),
    ultimaSync(),
  ]);

  const reqExclusao = new Map<string, string>();
  const reqCriacao: { email: string; id: string }[] = [];
  for (const f of chamados) {
    if (f.payload && "gTipo" in f.payload) {
      if (f.payload.gTipo === "exclusao") reqExclusao.set(f.payload.email, f.id);
      else reqCriacao.push({ email: f.payload.email, id: f.id });
    }
  }

  const membrosDe = (email: string) => {
    const dos = ((colabs ?? []) as Pick<Colaborador, "nome" | "email" | "status" | "grupos" | "bloqueado">[])
      .filter((c) => c.email && c.status !== "Desligado" && !c.bloqueado && (c.grupos ?? []).includes(email))
      .map((c) => ({ nome: c.nome, email: c.email! }));
    const ext = ((externos ?? []) as MembroExterno[])
      .filter((m) => m.grupo_email === email)
      .map((m) => ({ nome: m.nome, email: m.email }));
    const vistos = new Set<string>();
    return [...dos, ...ext]
      .filter((m) => (vistos.has(m.email) ? false : (vistos.add(m.email), true)))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  };

  const lista: GrupoView[] = ((grupos ?? []) as GrupoWorkspace[]).map((g) => ({
    nome: g.nome,
    email: g.email,
    membros: membrosDe(g.email),
    reqExclusaoId: reqExclusao.get(g.email) ?? null,
  }));

  const papel = usuario.papel;
  const podeExcluirDireto = papel === "Superadmin" || papel.startsWith("Admin") || papel === "Usuário T.I";

  return (
    <GruposClient
      grupos={lista}
      reqCriacao={reqCriacao}
      podeExcluirDireto={podeExcluirDireto}
      syncHora={quandoBR(sync.membros ?? sync.grupos ?? new Date().toISOString())}
    />
  );
}
