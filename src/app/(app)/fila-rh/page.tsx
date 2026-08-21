import { db } from "@/lib/db";
import { contexto, colaboradoresDaUnidade, chamadosAbertos, daUnidade } from "@/lib/data";
import { dataBR, quandoBR } from "@/lib/format";
import { pendenciasRH } from "@/lib/pendencias";
import { FilaRHClient, type CardRH } from "./FilaRHClient";
import type { ChecklistItem, Evento } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function FilaRHPage() {
  const { filtro } = await contexto("rh");
  const [colabs, chamados] = await Promise.all([colaboradoresDaUnidade(filtro), chamadosAbertos()]);
  const ids = colabs.map((c) => c.id);

  const [{ data: itens }, { data: eventosAf }] = await Promise.all([
    ids.length
      ? db().from("checklist_itens").select("*").in("colaborador_id", ids)
      : Promise.resolve({ data: [] as ChecklistItem[] }),
    ids.length
      ? db().from("eventos").select("*").eq("fase", "afastado").in("colaborador_id", ids).order("quando")
      : Promise.resolve({ data: [] as Evento[] }),
  ]);

  const slaPorColab: Record<string, string | null> = {};
  const chamadoPorColab: Record<string, string> = {};
  for (const f of chamados)
    if (f.colaborador_id) {
      slaPorColab[f.colaborador_id] = f.sla_alvo;
      chamadoPorColab[f.colaborador_id] = f.id;
    }

  // documentos anexados: usado tanto nas pendências quanto na coluna de docs
  const { data: docs } = ids.length
    ? await db().from("documentos").select("colaborador_id").in("colaborador_id", ids)
    : { data: [] };
  const comDocs = new Set((docs ?? []).map((d) => d.colaborador_id));

  // A TI já entregou a conta (e-mail preenchido) → só falta o RH ativar
  const prontos: CardRH[] = colabs
    .filter((c) => c.status === "Pré-admissão" && !!c.email)
    .map((c) => ({
      key: `ativar-${c.id}`,
      nome: c.nome,
      id: "",
      sub: `${c.email} · conta criada pela TI`,
      slaAlvo: null,
      urgCor: "var(--ok)",
      acao: "Ver perfil",
      href: `/colaboradores/${c.id}`,
      ativarColabId: c.id,
    }));

  // sem chamado aberto = admissão cancelada ou já resolvida: sai da fila,
  // mas continua existindo em Colaboradores
  const pre: CardRH[] = colabs
    .filter((c) => c.status === "Pré-admissão" && !c.email && !!chamadoPorColab[c.id])
    .map((c) => ({
      key: c.id,
      nome: c.nome,
      id: chamadoPorColab[c.id] ?? "",
      sub: `${c.cargo ?? "cargo a definir"} · admissão ${dataBR(c.admissao)}`,
      slaAlvo: slaPorColab[c.id] ?? null,
      urgCor: "var(--color-accent)",
      acao: "Revisar",
      href: `/colaboradores/${c.id}`,
      pendencias: pendenciasRH(c, comDocs.has(c.id)),
    }));

  const off: CardRH[] = chamados
    .filter((f) => f.tipo === "Desligamento" && f.colaborador_id)
    .map((f) => {
      const c = colabs.find((x) => x.id === f.colaborador_id);
      if (!c || !daUnidade(c, filtro)) return null;
      const doColab = ((itens ?? []) as ChecklistItem[]).filter((i) => i.colaborador_id === c.id);
      const done = doColab.filter((i) => i.done).length;
      return {
        key: f.id,
        nome: c.nome,
        id: f.id,
        sub: `desligamento em ${dataBR(c.desligamento)} · checklist ${done} de ${doColab.length}`,
        slaAlvo: null,
        urgCor: "var(--warn)",
        acao: "Abrir checklist",
        href: `/offboarding/${c.id}`,
      };
    })
    .filter(Boolean) as CardRH[];

  const docsPend: CardRH[] = [];
  for (const c of colabs.filter((c) => c.status === "Pré-admissão" && !comDocs.has(c.id) && !!chamadoPorColab[c.id])) {
    docsPend.push({
      key: c.id,
      nome: c.nome,
      id: chamadoPorColab[c.id] ?? "",
      sub: "contrato de trabalho ainda não anexado",
      slaAlvo: null,
      urgCor: "var(--color-neutral-300)",
      acao: "Ver perfil",
      href: `/colaboradores/${c.id}`,
    });
  }

  const af: CardRH[] = colabs
    .filter((c) => c.status === "Afastado")
    .map((c) => {
      const e0 = ((eventosAf ?? []) as Evento[]).find((e) => e.colaborador_id === c.id);
      return {
        key: c.id,
        nome: c.nome,
        id: "",
        sub: `INSS · afastado desde ${e0 ? quandoBR(e0.quando).split(" ")[0] : "—"}`,
        slaAlvo: null,
        urgCor: "var(--warn)",
        acao: "Ver perfil",
        href: `/colaboradores/${c.id}`,
      };
    });

  return (
    <FilaRHClient
      unidadeAtual={`${filtro.cidade} · ${filtro.unidade}`}
      cols={[
        { label: "Prontos para ativar", cor: "var(--ok-forte)", cards: prontos },
        { label: "Pré-admissões", cor: "var(--color-accent-700)", cards: pre },
        { label: "Offboarding", cor: "var(--warn-forte)", cards: off },
        { label: "Documentos pendentes", cor: "var(--danger-forte)", cards: docsPend },
        { label: "Afastamentos", cor: "var(--color-neutral-600)", cards: af },
      ]}
    />
  );
}
