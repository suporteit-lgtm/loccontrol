import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { contexto, colaborador } from "@/lib/data";
import { dataBR } from "@/lib/format";
import { ChecklistClient } from "./ChecklistClient";
import type { ChecklistItem, Documento } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function OffboardingPage({ params }: { params: Promise<{ id: string }> }) {
  await contexto();
  const { id } = await params;
  const c = await colaborador(id);
  if (!c) notFound();

  const [{ data: itens }, { data: docs }] = await Promise.all([
    db().from("checklist_itens").select("*").eq("colaborador_id", id).order("ordem"),
    db().from("documentos").select("*").eq("colaborador_id", id),
  ]);

  const termo = ((docs ?? []) as Documento[]).find((d) => d.arquivo.startsWith("termo"));

  return (
    <ChecklistClient
      colab={{ id: c.id, nome: c.nome, desligamento: dataBR(c.desligamento) }}
      itens={(itens ?? []) as ChecklistItem[]}
      termo={termo ? { arquivo: termo.arquivo, data: dataBR(termo.assinado_em) } : null}
    />
  );
}
