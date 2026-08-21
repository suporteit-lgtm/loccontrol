"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { exigirSessao, ehAdmin } from "@/lib/perms";
import { auditar } from "@/lib/audit";
import { proximoChamadoId } from "@/lib/data";
import { emitir } from "@/lib/notificar";
import { abrirTicket } from "@/services/tickets";
import type { Chamado } from "@/lib/types";

/** Define o grupo do Workspace de uma unidade (somente admins). */
export async function definirGrupoUnidade(cidade: string, unidade: string, email: string) {
  const u = await exigirSessao();
  if (!ehAdmin(u.papel)) return { ok: false, msg: "Apenas administradores definem o grupo da unidade" };

  const valor = email.trim().toLowerCase();
  if (valor && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor))
    return { ok: false, msg: "Informe um e-mail de grupo válido" };

  const { data: cid } = await db().from("cidades").select("id").eq("nome", cidade).maybeSingle();
  if (!cid) return { ok: false, msg: "Cidade não encontrada" };

  await db()
    .from("unidades")
    .update({ email_grupo: valor || null })
    .eq("cidade_id", cid.id)
    .eq("nome", unidade);

  await auditar({
    ator: u.nome,
    tabela: "unidades",
    campo: `${cidade} · ${unidade} · grupo`,
    depois: valor || "removido",
  });
  revalidatePath("/unidades");
  revalidatePath("/pre-admissao");
  return { ok: true, msg: valor ? `Grupo de ${unidade} definido como ${valor}` : `Grupo de ${unidade} removido` };
}

type Acao = "add-cidade" | "del-cidade" | "add-unid" | "del-unid";

const LABELS: Record<Acao, string> = {
  "add-cidade": "Criação de cidade",
  "del-cidade": "Remoção de cidade",
  "add-unid": "Criação de unidade",
  "del-unid": "Remoção de unidade",
};

async function jaSolicitado(acao: Acao, cidade: string, unidade?: string) {
  const { data } = await db().from("chamados").select("id, payload").not("payload", "is", null).is("concluido_em", null);
  return (data ?? []).some((f) => {
    const p = f.payload as { acao?: string; cidade?: string; unidade?: string } | null;
    return p?.acao === acao && p.cidade === cidade && (p.unidade ?? "") === (unidade ?? "");
  });
}

async function executarDireto(acao: Acao, cidade: string, unidade?: string): Promise<string> {
  if (acao === "add-cidade") {
    const { data: nova } = await db().from("cidades").insert({ nome: cidade }).select("id").single();
    if (nova) await db().from("unidades").insert({ cidade_id: nova.id, nome: "Centro" });
    return `Cidade ${cidade} adicionada com a unidade Centro`;
  }
  if (acao === "del-cidade") {
    await db().from("cidades").delete().eq("nome", cidade);
    return `Cidade ${cidade} removida`;
  }
  const { data: cid } = await db().from("cidades").select("id").eq("nome", cidade).maybeSingle();
  if (!cid) return "Cidade não encontrada";
  if (acao === "add-unid") {
    await db().from("unidades").upsert({ cidade_id: cid.id, nome: unidade! }, { onConflict: "cidade_id,nome" });
    return `Unidade ${unidade} adicionada em ${cidade}`;
  }
  await db().from("unidades").delete().eq("cidade_id", cid.id).eq("nome", unidade!);
  return `Unidade ${unidade} removida de ${cidade}`;
}

/** Admins executam direto; não-admins geram solicitação na Fila da TI. */
export async function solicitarUnidade(acao: Acao, cidade: string, unidade?: string) {
  const u = await exigirSessao();
  const c = cidade.trim();
  if (!c) return { ok: false, msg: "Informe o nome" };

  if (acao === "add-cidade") {
    const { data: existe } = await db().from("cidades").select("id").eq("nome", c).maybeSingle();
    if (existe) return { ok: false, msg: "Esta cidade já existe" };
  }
  if (acao === "add-unid" && unidade) {
    const { data: cid } = await db().from("cidades").select("id").eq("nome", c).maybeSingle();
    if (cid) {
      const { data: existe } = await db()
        .from("unidades")
        .select("id")
        .eq("cidade_id", cid.id)
        .eq("nome", unidade)
        .maybeSingle();
      if (existe) return { ok: false, msg: "Esta unidade já existe" };
    }
  }

  if (ehAdmin(u.papel)) {
    const msg = await executarDireto(acao, c, unidade);
    await auditar({
      ator: u.nome,
      tabela: "unidades",
      campo: unidade ? `${c} · ${unidade}` : c,
      depois: acao.startsWith("add") ? "criado" : "removido",
    });
    revalidatePath("/unidades");
    revalidatePath("/fila-ti");
    return { ok: true, msg };
  }

  if (await jaSolicitado(acao, c, unidade))
    return { ok: false, msg: acao.includes("cidade") ? "Já existe uma solicitação para esta cidade" : "Já existe uma solicitação para esta unidade" };

  const id = await proximoChamadoId();
  const payload: Chamado["payload"] = { acao, cidade: c, unidade: unidade ?? "" };
  await db().from("chamados").insert({
    id,
    tipo: LABELS[acao],
    silenciado: false,
    payload,
    solicitante: u.nome,
  });
  await emitir(
    "chamado",
    "admins",
    `Aprovação pendente: ${LABELS[acao].toLowerCase()}`,
    `${u.nome} solicitou ${LABELS[acao].toLowerCase()} — ${unidade ? `${c} · ${unidade}` : c}. Solicitação ${id} na Fila da TI.`,
    id
  );
  await abrirTicket({
    ref: id,
    tipo: "solicitacao",
    titulo: `${LABELS[acao]}: ${unidade ? `${c} · ${unidade}` : c}`,
    descricao: `Solicitado por ${u.nome} no LOCCONTROL — aguardando aprovação de um admin na Fila da TI.`,
    solicitanteEmail: u.email,
  });
  revalidatePath("/unidades");
  revalidatePath("/fila-ti");
  return { ok: true, msg: `Solicitação ${id} enviada aos administradores` };
}
