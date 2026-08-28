import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { auditar } from "@/lib/audit";
import { emitir } from "@/lib/notificar";

export const dynamic = "force-dynamic";

/**
 * Webhook do sistema de chamados interno → LOCCONTROL.
 * Recebe mudanças de status de chamados com origem LOCCONTROL, assinadas com
 * HMAC-SHA256 (header X-Assinatura, segredo em TICKETS_WEBHOOK_SECRET).
 * Contrato: docs/PROMPT-API-CHAMADOS-CLAUDE.md
 */

interface PayloadWebhook {
  referencia_externa: string;
  status: "aberto" | "em_andamento" | "pausado" | "concluido" | "cancelado";
  ator?: string;
  quando?: string;
}

function assinaturaValida(corpo: string, header: string | null): boolean {
  const segredo = process.env.TICKETS_WEBHOOK_SECRET;
  if (!segredo || !header) return false;
  const esperada = "sha256=" + createHmac("sha256", segredo).update(corpo).digest("hex");
  const a = Buffer.from(esperada);
  const b = Buffer.from(header);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const corpo = await req.text();

  if (!assinaturaValida(corpo, req.headers.get("x-assinatura"))) {
    return NextResponse.json({ erro: "assinatura_invalida" }, { status: 401 });
  }

  let p: PayloadWebhook;
  try {
    p = JSON.parse(corpo);
  } catch {
    return NextResponse.json({ erro: "validacao", detalhe: "corpo não é JSON" }, { status: 400 });
  }
  if (!p.referencia_externa || !p.status) {
    return NextResponse.json(
      { erro: "validacao", detalhe: "referencia_externa e status são obrigatórios" },
      { status: 400 }
    );
  }

  const { data: chamado } = await db()
    .from("chamados")
    .select("id, tipo, colaborador_id, silenciado, concluido_em, solicitante, colaboradores(nome, cidade, unidade)")
    .eq("id", p.referencia_externa)
    .maybeSingle();

  // não existe ou já arquivado — idempotente, 200
  if (!chamado || chamado.concluido_em)
    return NextResponse.json({ ok: true, detalhe: "chamado não está mais na fila" });

  const colab = (chamado as { colaboradores?: { nome?: string; cidade?: string | null; unidade?: string | null } })
    .colaboradores;
  const nome = colab?.nome ?? p.referencia_externa;
  const unidadeRef = colab?.cidade && colab?.unidade ? `${colab.cidade}|${colab.unidade}` : null;
  const ator = p.ator ?? "sistema de chamados";

  if (p.status === "concluido" && chamado.tipo === "Desligamento") {
    // A ferramenta concluiu a PARTE DA TI. O RH ainda tem a dele: o chamado
    // sai só da fila da TI; na do RH continua, com o checklist da TI riscado.
    await db().from("chamados").update({ ti_concluido: true, silenciado: false }).eq("id", chamado.id);
    if (chamado.colaborador_id) {
      await db()
        .from("checklist_itens")
        .update({ done: true })
        .eq("colaborador_id", chamado.colaborador_id)
        .eq("lista", "ti");
    }
    await auditar({
      pessoa: nome,
      ator,
      tabela: "chamados",
      campo: chamado.id,
      antes: "na fila da TI",
      depois: "parte da TI concluída (via ferramenta) · aguardando o RH",
    });
    const { data: quemAbriu } = chamado.solicitante
      ? await db().from("usuarios").select("email").eq("nome", chamado.solicitante).maybeSingle()
      : { data: null };
    await emitir(
      "chamado",
      "rh",
      `TI concluiu o desligamento de ${nome}`,
      `Chamado ${chamado.id} finalizado pela TI na ferramenta (${ator}). Falta a parte do RH no offboarding.`,
      `${chamado.id}:webhook-ti-ok`,
      quemAbriu?.email ?? null,
      undefined,
      unidadeRef
    );
  } else if (p.status === "concluido" || p.status === "cancelado") {
    await db()
      .from("chamados")
      .update({
        concluido_em: new Date().toISOString(),
        resultado: p.status === "concluido" ? "concluido" : "cancelado",
        concluido_por: ator,
      })
      .eq("id", chamado.id);
    await auditar({
      pessoa: nome,
      ator,
      tabela: "chamados",
      campo: chamado.id,
      antes: "na fila",
      depois: p.status === "concluido" ? "concluído (via ferramenta de chamados)" : "cancelado (via ferramenta de chamados)",
    });
    await emitir(
      "chamado",
      "ti",
      `Chamado ${chamado.id} ${p.status === "concluido" ? "concluído" : "cancelado"} na ferramenta`,
      `${chamado.tipo} · ${nome} · por ${ator}.`,
      `${chamado.id}:webhook-${p.status}`,
      undefined,
      undefined,
      unidadeRef
    );
  } else if (p.status === "pausado" && !chamado.silenciado) {
    await db().from("chamados").update({ silenciado: true }).eq("id", chamado.id);
    await auditar({ pessoa: nome, ator, tabela: "chamados", campo: chamado.id, antes: "ativo", depois: "pausado (via ferramenta)" });
  } else if ((p.status === "aberto" || p.status === "em_andamento") && chamado.silenciado) {
    await db().from("chamados").update({ silenciado: false }).eq("id", chamado.id);
    await auditar({ pessoa: nome, ator, tabela: "chamados", campo: chamado.id, antes: "pausado", depois: "reativado (via ferramenta)" });
  }

  return NextResponse.json({ ok: true });
}
