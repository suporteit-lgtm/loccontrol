import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { contexto, colaborador } from "@/lib/data";
import { dataBR } from "@/lib/format";
import { ChecklistClient } from "./ChecklistClient";
import type { ChecklistItem, Documento } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function OffboardingPage({ params }: { params: Promise<{ id: string }> }) {
  const { usuario } = await contexto();
  const { id } = await params;
  const c = await colaborador(id);
  if (!c) notFound();

  const [{ data: itens }, { data: docs }, { data: abertos }] = await Promise.all([
    db().from("checklist_itens").select("*").eq("colaborador_id", id).order("ordem"),
    db().from("documentos").select("*").eq("colaborador_id", id),
    db()
      .from("chamados")
      .select("id, ti_concluido")
      .eq("colaborador_id", id)
      .eq("tipo", "Desligamento")
      .is("concluido_em", null),
  ]);

  const termo = ((docs ?? []) as Documento[]).find((d) => d.arquivo.startsWith("termo"));
  const ehTimeTI = usuario.papel.includes("T.I") || usuario.papel === "Superadmin";

  return (
    <ChecklistClient
      colab={{ id: c.id, nome: c.nome, desligamento: dataBR(c.desligamento) }}
      itens={(itens ?? []) as ChecklistItem[]}
      termo={termo ? { arquivo: termo.arquivo, data: dataBR(termo.assinado_em) } : null}
      // volta para a fila do time da pessoa: TI (e Superadmin) → fila da TI
      filaHref={ehTimeTI ? "/fila-ti" : "/fila-rh"}
      ehTI={ehTimeTI}
      // ainda existe chamado aberto com a parte da TI pendente?
      tiPendente={(abertos ?? []).some((f) => !f.ti_concluido)}
    />
  );
}
