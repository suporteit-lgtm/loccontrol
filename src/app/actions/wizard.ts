"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { exigirRH } from "@/lib/perms";
import { auditar } from "@/lib/audit";
import { proximoChamadoId } from "@/lib/data";
import { buscarPreAdmissao } from "@/services/quarkrh";
import { abrirTicket } from "@/services/tickets";
import { emitir } from "@/lib/notificar";
import { templateChamado } from "@/services/emailChamado";

export interface CampoWizard {
  k: string;
  v: string;
  selo: boolean;
  mono?: boolean;
}

export interface DraftWizard {
  step: number;
  busca: string;
  campos: CampoWizard[] | null;
  cargo: string;
  cidade: string;
  unidade: string;
  acc: Record<string, { on: boolean; obrig: boolean; just: string }> | null;
  equip: Record<string, boolean>;
  grupos: string[];
  grupoLivre: string;
  obs: string;
  analista: string;
  ticket: string | null;
}

export async function salvarDraft(dados: DraftWizard) {
  const u = await exigirRH();
  await db()
    .from("wizard_drafts")
    .upsert({ usuario_id: u.id, dados, atualizado_em: new Date().toISOString() });
  return { ok: true };
}

export async function limparDraft() {
  const u = await exigirRH();
  await db().from("wizard_drafts").delete().eq("usuario_id", u.id);
  return { ok: true, msg: "Campos da pré-admissão limpos" };
}

export interface OpcaoQuark {
  quarkId: number;
  nome: string;
  cpf: string;
  cargo: string;
  unidadeQuark: string;
  admissao: string;
  desligado: boolean;
  campos: CampoWizard[];
}

function camposDe(r: {
  nome: string;
  cpf: string;
  admissao: string;
  cargo: string;
  dept: string;
  telefone: string;
  email: string;
}): CampoWizard[] {
  return [
    { k: "Nome completo", v: r.nome, selo: true },
    { k: "CPF", v: r.cpf, selo: true, mono: true },
    { k: "Data de admissão", v: r.admissao, selo: true, mono: true },
    { k: "Cargo", v: r.cargo, selo: true },
    { k: "Departamento", v: r.dept, selo: true },
    { k: "Telefone", v: r.telefone, selo: true, mono: true },
    { k: "E-mail pessoal", v: r.email, selo: true, mono: true },
  ];
}

/**
 * Busca no QuarkRH por CPF ou nome. Retorna todos os candidatos —
 * a tela decide entre preencher direto (1 resultado) ou pedir escolha.
 */
export async function buscarQuark(
  termo: string
): Promise<{ ok: boolean; opcoes: OpcaoQuark[]; msg?: string }> {
  await exigirRH();
  const r = await buscarPreAdmissao(termo);
  if (!r.ok) return { ok: false, opcoes: [], msg: `QuarkRH: ${r.erro}` };
  if (!r.resultados.length)
    return { ok: false, opcoes: [], msg: "Ninguém encontrado no QuarkRH com esse CPF ou nome" };

  return {
    ok: true,
    opcoes: r.resultados.map((c) => ({
      quarkId: c.quarkId,
      nome: c.nome,
      cpf: c.cpf,
      cargo: c.cargo,
      unidadeQuark: c.unidadeQuark,
      admissao: c.admissao,
      desligado: c.desligado,
      campos: camposDe(c),
    })),
  };
}

function isoDeBR(d: string): string | null {
  const m = d.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

export async function abrirChamadoWizard(draft: DraftWizard) {
  const u = await exigirRH();

  // Em modo de desenvolvimento, simula a criação para poupar o banco de dados real (Supabase)
  if (process.env.NODE_ENV === "development") {
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Simula tempo de rede para a animação
    return { 
      ok: true as const, 
      msg: "[Local] Chamado simulado · Banco de dados preservado", 
      chamadoId: `CH-DEV-${Math.floor(Math.random() * 1000)}`, 
      colabId: "simulado-123" 
    };
  }

  const campo = (k: string) => draft.campos?.find((c) => c.k === k)?.v?.trim() ?? "";
  const nome = campo("Nome completo");
  if (!nome) return { ok: false as const, msg: "Preencha o nome no passo 1" };

  const admissaoIso = isoDeBR(campo("Data de admissão"));
  const equipamentos = Object.keys(draft.equip).filter((e) => draft.equip[e]);
  const acessosDesligados = draft.acc
    ? Object.entries(draft.acc)
        .filter(([, v]) => v.obrig && !v.on)
        .map(([k, v]) => `${k}${v.just ? ` (${v.just})` : ""}`)
    : [];
  // O que o RH marcou é o que a TI vai ver no chamado — nada mais.
  const acessosAprovados = draft.acc
    ? Object.entries(draft.acc)
        .filter(([, v]) => v.on)
        .map(([k]) => k)
    : null;

  const { data: novo, error } = await db()
    .from("colaboradores")
    .insert({
      nome,
      cpf: campo("CPF") || "—",
      cargo: draft.cargo,
      dept: campo("Departamento") || "—",
      admissao: admissaoIso,
      status: "Pré-admissão",
      email: null,
      telefone: campo("Telefone") || null,
      email_pessoal: campo("E-mail pessoal")?.toLowerCase() || null,
      cidade: draft.cidade,
      unidade: draft.unidade,
      grupos: draft.grupos,
      equipamentos,
      acessos: acessosAprovados,
      analista: draft.analista,
      obs_ti: [draft.obs.trim(), acessosDesligados.length ? `Acessos obrigatórios removidos: ${acessosDesligados.join(", ")}` : ""]
        .filter(Boolean)
        .join(" · ") || null,
    })
    .select("id")
    .single();
  if (error || !novo) return { ok: false as const, msg: `Erro ao criar pré-admissão: ${error?.message}` };

  const chamadoId = await proximoChamadoId();
  await db().from("chamados").insert({
    id: chamadoId,
    colaborador_id: novo.id,
    tipo: "Admissão",
    solicitante: u.nome,
    silenciado: false,
    // SLA = data de admissão às 08:00 (contagem regressiva na fila)
    sla_alvo: admissaoIso ? `${admissaoIso}T08:00:00` : null,
    analista: draft.analista,
  });

  await db().from("eventos").insert([
    { colaborador_id: novo.id, fase: "pre", ator: `${u.nome} · RH`, descricao: "Pré-admissão criada" },
    { colaborador_id: novo.id, fase: "pre", ator: "Sistema", descricao: `Chamado ${chamadoId} aberto para ${draft.analista}` },
  ]);

  await auditar({ pessoa: nome, ator: u.nome, tabela: "colaboradores", campo: "registro", depois: "criado" });

  // espelha na ferramenta de chamados (melhor-esforço)
  const { data: analistaRow } = await db()
    .from("usuarios")
    .select("email")
    .eq("nome", draft.analista)
    .maybeSingle();
  await abrirTicket({
    ref: chamadoId,
    tipo: "admissao",
    titulo: `Admissão de ${nome} — ${draft.cargo}`,
    descricao: [
      `Unidade: ${draft.cidade} · ${draft.unidade}`,
      `Admissão: ${campo("Data de admissão") || "—"}`,
      `Acessos: ${draft.acc ? Object.entries(draft.acc).filter(([, v]) => v.on).map(([k]) => k).join(", ") || "nenhum" : "conforme matriz"}`,
      `Grupos: ${draft.grupos.join(", ") || "nenhum"}`,
      `Equipamentos: ${equipamentos.join(", ") || "nenhum"}`,
      draft.obs.trim() ? `Observação do RH: ${draft.obs.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    prazo: admissaoIso ? `${admissaoIso}T08:00:00-03:00` : null,
    responsavelEmail: analistaRow?.email ?? null,
    solicitanteEmail: u.email,
  });
  await emitir(
    "pre",
    "ti",
    `Nova pré-admissão: ${nome}`,
    `${draft.cargo} · ${draft.cidade} · ${draft.unidade}. Chamado ${chamadoId} aberto para ${draft.analista}.`,
    chamadoId,
    analistaRow?.email ?? null, // navegador e e-mail: só o analista atribuído
    templateChamado({
      eyebrow: "Nova pré-admissão",
      nome,
      cargo: draft.cargo,
      unidade: `${draft.cidade} · ${draft.unidade}`,
      responsavel: draft.analista,
      chamadoId,
      nota: "O chamado foi aberto automaticamente para dar continuidade ao processo de admissão.",
      rota: `/chamados/${chamadoId}`,
    }),
    `${draft.cidade}|${draft.unidade}`
  );

  // guarda o passo 4 no rascunho (persistência entre telas, como no protótipo)
  await db()
    .from("wizard_drafts")
    .upsert({
      usuario_id: u.id,
      dados: { ...draft, step: 4, ticket: chamadoId },
      atualizado_em: new Date().toISOString(),
    });

  revalidatePath("/colaboradores");
  revalidatePath("/fila-ti");
  revalidatePath("/dash");
  return { ok: true as const, msg: "Chamado aberto · TI notificada", chamadoId, colabId: novo.id };
}
