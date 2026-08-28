"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { exigirAdmin } from "@/lib/perms";
import { auditar } from "@/lib/audit";
import { GUIAS } from "@/lib/guias";

/**
 * Define (ou remove, com url vazia) o vídeo de um guia da Central de ajuda.
 * Aceita link do YouTube ou do Google Drive — o player é montado na tela.
 */
export async function salvarVideoAjuda(chave: string, url: string) {
  const u = await exigirAdmin();
  const guia = GUIAS.find((g) => g.chave === chave);
  if (!guia) return { ok: false as const, msg: "Guia não encontrado" };

  const limpo = url.trim();
  if (!limpo) {
    await db().from("ajuda_videos").delete().eq("chave", chave);
    await auditar({ ator: u.nome, tabela: "ajuda", campo: guia.titulo, antes: "com vídeo", depois: "vídeo removido" });
    revalidatePath("/ajuda");
    return { ok: true as const, msg: `Vídeo removido de "${guia.titulo}"` };
  }

  if (!/^https:\/\//i.test(limpo))
    return { ok: false as const, msg: "Cole o link completo, começando com https://" };

  await db()
    .from("ajuda_videos")
    .upsert({ chave, url: limpo, atualizado_em: new Date().toISOString(), atualizado_por: u.nome });
  await auditar({ ator: u.nome, tabela: "ajuda", campo: guia.titulo, depois: limpo });
  revalidatePath("/ajuda");
  return { ok: true as const, msg: `Vídeo salvo em "${guia.titulo}"` };
}
