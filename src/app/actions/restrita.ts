"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { exigirSessao } from "@/lib/perms";
import { auditar } from "@/lib/audit";
import { agora } from "@/lib/format";
import { executarPassoPanico, type PassoPanico } from "@/services/googleWorkspace";

/** Somente o grupo de T.I (Superadmin, Admin T.I, Usuário T.I) desbloqueia. */
function ehGrupoTI(papel: string) {
  return papel === "Superadmin" || papel.includes("T.I");
}

/** Executa um passo do bloqueio de emergência via o stub do Workspace Admin SDK. */
export async function executarPasso(alvoId: string, passo: PassoPanico) {
  await exigirSessao();
  const { data: c } = await db().from("colaboradores").select("email, nome").eq("id", alvoId).maybeSingle();
  if (!c) return { ok: false, erro: "Colaborador não encontrado" };
  // PENDENTE: integração real com o Workspace Admin SDK
  const r = await executarPassoPanico(c.email ?? c.nome, passo);
  return r;
}

/** Registra o bloqueio após os 3 passos concluírem com sucesso. */
export async function concluirBloqueio(alvoId: string, motivo: string) {
  const u = await exigirSessao();
  if (motivo.trim().length < 10) return { ok: false as const, msg: "Motivo muito curto" };
  const { data: c } = await db().from("colaboradores").select("nome, bloqueado").eq("id", alvoId).maybeSingle();
  if (!c) return { ok: false as const, msg: "Colaborador não encontrado" };
  if (c.bloqueado) return { ok: false as const, msg: "Este colaborador já está bloqueado" };

  const quando = agora();
  await db()
    .from("colaboradores")
    .update({ bloqueado: { quando, por: u.nome, motivo: motivo.trim() } })
    .eq("id", alvoId);

  await db().from("eventos").insert({
    colaborador_id: alvoId,
    fase: "ativo",
    ator: `${u.nome}`,
    descricao: `Bloqueio de emergência executado · ${motivo.trim()}`,
  });
  await auditar({
    pessoa: c.nome,
    ator: u.nome,
    tabela: "colaboradores",
    campo: "bloqueio",
    antes: "ativo",
    depois: "bloqueado",
  });

  revalidatePath("/restrita");
  revalidatePath(`/colaboradores/${alvoId}`);
  return { ok: true as const, msg: `Acesso de ${c.nome} bloqueado`, quando };
}

/**
 * Remove o bloqueio do PERFIL no sistema (caso a pessoa volte à empresa).
 * Não mexe na conta Google — senha e sessões continuam como o pânico deixou;
 * a reativação da conta é feita no console do Workspace por um admin.
 * Restrito ao grupo de T.I.
 */
export async function removerBloqueio(alvoId: string) {
  const u = await exigirSessao();
  if (!ehGrupoTI(u.papel))
    return { ok: false, msg: "Somente o grupo de T.I pode remover o bloqueio" };

  const { data: c } = await db().from("colaboradores").select("nome, bloqueado").eq("id", alvoId).maybeSingle();
  if (!c) return { ok: false, msg: "Colaborador não encontrado" };
  if (!c.bloqueado) return { ok: false, msg: "Este colaborador não está bloqueado" };

  await db().from("colaboradores").update({ bloqueado: null }).eq("id", alvoId);
  await db().from("eventos").insert({
    colaborador_id: alvoId,
    fase: "ativo",
    ator: `${u.nome} · TI`,
    descricao: "Bloqueio removido do perfil — conta segue conforme o console do Workspace",
  });
  await auditar({
    pessoa: c.nome,
    ator: u.nome,
    tabela: "colaboradores",
    campo: "bloqueio",
    antes: "bloqueado",
    depois: "desbloqueado",
  });

  revalidatePath("/restrita");
  revalidatePath(`/colaboradores/${alvoId}`);
  return { ok: true, msg: `Bloqueio de ${c.nome} removido do perfil` };
}
