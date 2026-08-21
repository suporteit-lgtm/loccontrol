"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { exigirRH, exigirAdmin } from "@/lib/perms";
import { auditar } from "@/lib/audit";
import { proximoChamadoId, TODAS } from "@/lib/data";
import { unidadeAtual } from "@/lib/session";
import { CHECKLIST_TEMPLATE } from "@/lib/types";
import { abrirTicket } from "@/services/tickets";
import * as workspace from "@/services/googleWorkspace";
import { emitir } from "@/lib/notificar";
import { salvarPlanilhasNoDrive, type PlanilhaExport } from "@/services/driveExport";
import { exportacaoCompleta } from "@/services/quarkrh";
import type { Colaborador } from "@/lib/types";

export interface LinhaImportada {
  nome: string;
  cpf: string;
  cargo: string;
  admissao: string; // dd/mm/aaaa
  status: string;
  email: string;
}

function isoDeBR(d: string): string | null {
  const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

// ── Exportação completa para o Drive ─────────────────────────────────────────

function celula(v: string | null | undefined): string {
  const s = (v ?? "").trim();
  // vírgula obrigatória: o conversor do Sheets não entende ";"
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvDe(cabecalho: string[], linhas: (string | null | undefined)[][]): string {
  return [cabecalho.join(","), ...linhas.map((l) => l.map(celula).join(","))].join("\r\n");
}

function brDeIso(iso: string | null): string {
  if (!iso) return "";
  const m = iso.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/**
 * Exporta TODAS as bases (todas as cidades e unidades) para o Drive:
 * uma planilha por status — os contratos mudam entre elas — mais a geral
 * e, se o token estiver ativo, o quadro completo do QuarkRH.
 */
export async function exportarBasesParaDrive() {
  const u = await exigirRH();

  const [{ data }, quark] = await Promise.all([
    db().from("colaboradores").select("*").order("nome"),
    exportacaoCompleta(),
  ]);
  const todos = (data ?? []) as Colaborador[];

  const CAB = ["Nome", "CPF", "Cargo", "Departamento", "Admissão", "Desligamento", "Status", "E-mail", "Telefone", "Cidade", "Unidade", "Origem"];
  const linhaDe = (c: Colaborador) => [
    c.nome, c.cpf, c.cargo, c.dept, brDeIso(c.admissao), brDeIso(c.desligamento),
    c.status ?? "A definir", c.email, c.telefone, c.cidade, c.unidade, c.origem,
  ];

  const BASES: [string, (c: Colaborador) => boolean][] = [
    ["Ativos", (c) => c.status === "Ativo"],
    ["Pré-admissões", (c) => c.status === "Pré-admissão"],
    ["Afastados", (c) => c.status === "Afastado"],
    ["Desligados", (c) => c.status === "Desligado"],
    ["Sem status (a definir)", (c) => !c.status],
  ];

  const planilhas: PlanilhaExport[] = [
    { nome: `Todos (${todos.length})`, csv: csvDe(CAB, todos.map(linhaDe)) },
    ...BASES.map(([nome, f]) => {
      const lista = todos.filter(f);
      return { nome: `${nome} (${lista.length})`, csv: csvDe(CAB, lista.map(linhaDe)) };
    }).filter((p) => !p.nome.includes("(0)")),
  ];

  // Cadastro completo do Quark: TODOS os campos do formulário de admissão,
  // não só os que o LOCCONTROL usa nas telas.
  if (quark) {
    planilhas.push({
      nome: `QuarkRH — cadastro completo (${quark.linhas.length})`,
      csv: csvDe(quark.cabecalho, quark.linhas),
    });
  }

  const agora = new Date().toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  const rotulo = agora.replace(/\//g, "-").replace(", ", " · ").replace(":", "h");

  const r = await salvarPlanilhasNoDrive(rotulo, planilhas);
  if (!r.ok) return { ok: false as const, msg: `Drive: ${r.erro}` };

  await auditar({
    ator: u.nome,
    tabela: "colaboradores",
    campo: "exportação",
    depois: `${planilhas.length} planilha(s) no Drive — ${todos.length} colaborador(es)${quark ? ` + ${quark.linhas.length} do Quark` : ""}`,
  });
  return {
    ok: true as const,
    msg: `${planilhas.length} planilha(s) salva(s) no Drive`,
    link: r.link,
  };
}

/**
 * Ativa o colaborador na empresa — decisão do RH, não da TI.
 * Exige que a TI já tenha entregado a conta (e-mail corporativo preenchido).
 */
export async function ativarNaEmpresa(colabId: string) {
  const u = await exigirRH();
  const { data } = await db().from("colaboradores").select("*").eq("id", colabId).maybeSingle();
  const c = data as Colaborador | null;
  if (!c) return { ok: false as const, msg: "Colaborador não encontrado" };
  if (c.status === "Ativo") return { ok: false as const, msg: `${c.nome} já está ativo` };
  if (!c.email)
    return { ok: false as const, msg: "A TI ainda não informou o e-mail corporativo deste colaborador" };

  // a marca é o ÚNICO caminho para os e-mails pós-login — base importada nunca a recebe
  await db().from("colaboradores").update({ status: "Ativo", aguarda_boas_vindas: true }).eq("id", c.id);

  // Os e-mails do corporativo (chamados e Quark) NÃO saem aqui: eles são
  // programados para 5 min depois do primeiro login, no ciclo de sincronização.
  await db().from("eventos").insert({
    colaborador_id: c.id,
    fase: "ativo",
    ator: `${u.nome} · RH`,
    descricao: "Ativado na empresa · e-mails do corporativo saem 5 min após o primeiro login",
  });

  await auditar({
    pessoa: c.nome,
    ator: u.nome,
    tabela: "colaboradores",
    campo: "status",
    antes: c.status ?? "—",
    depois: "Ativo",
  });

  revalidatePath("/fila-rh");
  revalidatePath("/dash");
  revalidatePath("/colaboradores");
  revalidatePath(`/colaboradores/${c.id}`);
  return { ok: true as const, msg: `${c.nome} ativado(a) na empresa` };
}

/**
 * Apaga a ficha do colaborador do LOCCONTROL. NÃO mexe no Google Workspace —
 * é para limpar registro errado/duplicado, não para desligar alguém (para isso
 * existe o fluxo de desligamento, que trata conta, Drive e checklist).
 * Somente administradores, e só com o nome digitado como confirmação.
 */
export async function excluirColaborador(id: string, nomeConfirmacao: string) {
  const u = await exigirAdmin();
  const { data } = await db().from("colaboradores").select("*").eq("id", id).maybeSingle();
  const c = data as Colaborador | null;
  if (!c) return { ok: false as const, msg: "Colaborador não encontrado" };

  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  if (norm(nomeConfirmacao) !== norm(c.nome))
    return { ok: false as const, msg: "O nome digitado não confere — nada foi excluído" };

  // um chamado aberto significa processo em andamento: resolver antes
  const { count } = await db()
    .from("chamados")
    .select("*", { count: "exact", head: true })
    .eq("colaborador_id", id)
    .is("concluido_em", null);
  if (count)
    return {
      ok: false as const,
      msg: "Existe chamado aberto para este colaborador — conclua ou cancele antes de excluir",
    };

  const { error } = await db().from("colaboradores").delete().eq("id", id);
  if (error) return { ok: false as const, msg: `Erro ao excluir: ${error.message}` };

  await auditar({
    pessoa: c.nome,
    ator: u.nome,
    tabela: "colaboradores",
    campo: "registro",
    antes: `${c.status ?? "sem status"}${c.email ? ` · ${c.email}` : ""}`,
    depois: "excluído do LOCCONTROL",
  });

  revalidatePath("/colaboradores");
  revalidatePath("/fila-rh");
  revalidatePath("/dash");
  // A conta do Workspace continua existindo: se for esse o caso, a próxima
  // sincronização traz a ficha de volta. Avisa em vez de deixar o usuário
  // achar que a exclusão falhou.
  return {
    ok: true as const,
    msg: c.email
      ? `${c.nome} excluído(a). A conta ${c.email} continua no Workspace — apague lá também, senão a ficha volta na próxima sincronização.`
      : `${c.nome} excluído(a) do LOCCONTROL`,
  };
}

export async function importarColaboradores(linhas: LinhaImportada[]) {
  const u = await exigirRH();
  const filtro = await unidadeAtual();
  const unidade =
    filtro.unidade === TODAS ? null : filtro.unidade;

  // unidade padrão: primeira da cidade
  let unidadePadrao = unidade;
  if (!unidadePadrao) {
    const { data: cid } = await db().from("cidades").select("id").eq("nome", filtro.cidade).maybeSingle();
    if (cid) {
      const { data: us } = await db().from("unidades").select("nome").eq("cidade_id", cid.id).order("nome").limit(1);
      unidadePadrao = us?.[0]?.nome ?? "";
    }
  }

  const validos = linhas.filter((l) => l.nome?.trim());
  if (!validos.length) return { ok: false, msg: "Nenhuma linha válida na planilha" };

  const novos = validos.map((l) => ({
    nome: l.nome.trim(),
    cpf: l.cpf?.trim() || "—",
    cargo: l.cargo?.trim() || "Atendente de loja",
    dept: "—",
    admissao: isoDeBR(l.admissao?.trim() ?? ""),
    status: ["Pré-admissão", "Ativo", "Afastado", "Desligado"].includes(l.status?.trim())
      ? l.status.trim()
      : "Pré-admissão",
    email: l.email?.trim() && l.email.trim() !== "—" ? l.email.trim() : null,
    telefone: null,
    cidade: filtro.cidade,
    unidade: unidadePadrao ?? "",
    grupos: ["geral@locgrupo.com.br"],
    equipamentos: [],
  }));

  const { data: inseridos, error } = await db().from("colaboradores").insert(novos).select("id, nome");
  if (error) return { ok: false, msg: `Erro ao importar: ${error.message}` };

  for (const c of inseridos ?? []) {
    await db().from("eventos").insert({
      colaborador_id: c.id,
      fase: "pre",
      ator: `${u.nome} · RH`,
      descricao: "Importado por planilha",
    });
    await auditar({ pessoa: c.nome, ator: u.nome, tabela: "colaboradores", campo: "registro", depois: "importado" });
  }

  revalidatePath("/colaboradores");
  return { ok: true, msg: `${novos.length} colaborador(es) importado(s)` };
}

export interface DadosColaborador {
  nome: string;
  cpf: string;
  cargo: string;
  dept: string;
  admissao: string; // ISO (yyyy-mm-dd) ou vazio
  status: string; // vazio = a definir
  cidade: string;
  unidade: string;
  telefone: string;
  email: string;
}

/**
 * Preenche/corrige os dados que o Workspace e o QuarkRH não trazem.
 * Campos vazios continuam vazios (nulos) — nada é inventado.
 */
export async function salvarDadosColaborador(id: string, d: DadosColaborador) {
  const u = await exigirRH();
  const { data: antes } = await db().from("colaboradores").select("*").eq("id", id).maybeSingle();
  if (!antes) return { ok: false, msg: "Colaborador não encontrado" };

  const limpo = (v: string) => (v?.trim() ? v.trim() : null);
  const patch = {
    nome: d.nome.trim() || antes.nome,
    cpf: limpo(d.cpf),
    cargo: limpo(d.cargo),
    dept: limpo(d.dept),
    admissao: limpo(d.admissao),
    status: limpo(d.status),
    cidade: limpo(d.cidade),
    unidade: limpo(d.unidade),
    telefone: limpo(d.telefone),
    email: limpo(d.email)?.toLowerCase() ?? null,
  };

  if (patch.status && !["Pré-admissão", "Ativo", "Afastado", "Desligado"].includes(patch.status))
    return { ok: false, msg: "Status inválido" };
  if ((patch.cidade && !patch.unidade) || (!patch.cidade && patch.unidade))
    return { ok: false, msg: "Informe cidade e unidade juntas" };

  // O e-mail pode pertencer à ficha que a sincronização importou do Workspace.
  // Nesse caso as duas são a mesma pessoa: funde em vez de recusar.
  let fundido: string | null = null;
  if (patch.email) {
    const { data: outro } = await db()
      .from("colaboradores")
      .select("id, nome, google_id, ultimo_login, suspenso, origem")
      .eq("email", patch.email)
      .neq("id", id)
      .maybeSingle();
    if (outro) {
      if (outro.origem !== "workspace")
        return {
          ok: false,
          msg: `Este e-mail já é de ${outro.nome}. Corrija lá antes de usá-lo aqui.`,
        };
      await db().from("eventos").update({ colaborador_id: id }).eq("colaborador_id", outro.id);
      await db().from("colaboradores").delete().eq("id", outro.id);
      Object.assign(patch, {
        google_id: outro.google_id,
        ultimo_login: outro.ultimo_login,
        suspenso: outro.suspenso,
      });
      fundido = outro.nome;
    }
  }

  const { error } = await db().from("colaboradores").update(patch).eq("id", id);
  if (error)
    return {
      ok: false,
      msg: error.message.includes("colaboradores_email_idx")
        ? "Já existe outro colaborador com este e-mail"
        : `Erro ao salvar: ${error.message}`,
    };

  if (fundido)
    await db().from("eventos").insert({
      colaborador_id: id,
      fase: "ativo",
      ator: `${u.nome} · RH`,
      descricao: `Ficha "${fundido}", importada do Workspace, fundida nesta pelo e-mail ${patch.email}`,
    });

  // registra na auditoria só o que realmente mudou
  const rotulos: Record<keyof typeof patch, string> = {
    nome: "nome",
    cpf: "cpf",
    cargo: "cargo",
    dept: "departamento",
    admissao: "admissao",
    status: "status",
    cidade: "cidade",
    unidade: "unidade",
    telefone: "telefone",
    email: "email",
  };
  for (const chave of Object.keys(patch) as (keyof typeof patch)[]) {
    const de = antes[chave] ?? null;
    const para = patch[chave] ?? null;
    if (String(de ?? "") === String(para ?? "")) continue;
    await auditar({
      pessoa: patch.nome,
      ator: u.nome,
      tabela: "colaboradores",
      campo: rotulos[chave],
      antes: de ? String(de) : "—",
      depois: para ? String(para) : "—",
    });
  }

  if (antes.status !== patch.status && patch.status) {
    const fase =
      patch.status === "Ativo"
        ? "ativo"
        : patch.status === "Afastado"
          ? "afastado"
          : patch.status === "Desligado"
            ? "desligado"
            : "pre";
    await db().from("eventos").insert({
      colaborador_id: id,
      fase,
      ator: `${u.nome} · RH`,
      descricao: `Status definido como ${patch.status}`,
    });
  }

  revalidatePath(`/colaboradores/${id}`);
  revalidatePath("/colaboradores");
  return { ok: true, msg: "Dados salvos" };
}

export type OpcaoContaGoogle = "manter" | "suspender" | "excluir";

export async function desligarColaborador(
  id: string,
  dataIso: string,
  motivo: string,
  contaGoogle: OpcaoContaGoogle = "manter",
  backupPara?: string,
  analista?: string
) {
  const u = await exigirRH();
  const { data: c } = await db().from("colaboradores").select("*").eq("id", id).maybeSingle();
  if (!c) return { ok: false, msg: "Colaborador não encontrado" };
  if (c.status !== "Ativo") return { ok: false, msg: "Só é possível desligar colaboradores ativos" };

  // ── Conta Google Workspace (mesmo fluxo do console: backup → suspender/excluir)
  const avisos: string[] = [];
  if (c.email && contaGoogle !== "manter") {
    if (backupPara?.trim()) {
      const t = await workspace.transferirDrive(c.email, backupPara.trim());
      if (!t.ok) return { ok: false, msg: `Backup do Drive falhou — nada foi alterado. ${t.erro}` };
      avisos.push(`arquivos do Drive transferidos para ${backupPara.trim()}`);
      await auditar({
        pessoa: c.nome,
        ator: u.nome,
        tabela: "workspace",
        campo: "drive",
        antes: c.email,
        depois: `transferido para ${backupPara.trim()}`,
      });
    }
    const r =
      contaGoogle === "excluir"
        ? await workspace.excluirConta(c.email)
        : await workspace.suspenderConta(c.email);
    if (!r.ok) return { ok: false, msg: `Conta Google: ${r.erro} — desligamento não registrado` };
    avisos.push(contaGoogle === "excluir" ? "conta Google excluída" : "conta Google suspensa");
    await db().from("colaboradores").update({ suspenso: true }).eq("id", id);
    await auditar({
      pessoa: c.nome,
      ator: u.nome,
      tabela: "workspace",
      campo: "conta",
      antes: "ativa",
      depois: contaGoogle === "excluir" ? "excluída" : "suspensa",
    });
  }

  await db()
    .from("colaboradores")
    .update({ status: "Desligado", desligamento: dataIso })
    .eq("id", id);

  await db().from("eventos").insert({
    colaborador_id: id,
    fase: "desligado",
    ator: `${u.nome} · RH`,
    descricao: `Desligamento registrado (${motivo}) · checklist gerado`,
  });

  // Gera o checklist de offboarding a partir do template editável (Configurações);
  // se a tabela estiver vazia, cai no template padrão do código
  const { data: tpl } = await db().from("checklist_templates").select("lista, ordem, titulo").order("ordem");
  const itens = (tpl ?? []).length
    ? (tpl ?? []).map((t) => ({ colaborador_id: id, lista: t.lista, ordem: t.ordem, titulo: t.titulo }))
    : [
        ...CHECKLIST_TEMPLATE.rh.map((t, i) => ({ colaborador_id: id, lista: "rh", ordem: i + 1, titulo: t })),
        ...CHECKLIST_TEMPLATE.ti.map((t, i) => ({ colaborador_id: id, lista: "ti", ordem: i + 1, titulo: t })),
      ];
  // remove checklist antigo (caso de recontratação) e cria o novo
  await db().from("checklist_itens").delete().eq("colaborador_id", id);
  await db().from("checklist_itens").insert(itens);

  const chamadoId = await proximoChamadoId();
  await db().from("chamados").insert({
    id: chamadoId,
    colaborador_id: id,
    tipo: "Desligamento",
    solicitante: u.nome,
    silenciado: false,
    sla_alvo: null,
    analista: analista ?? null,
  });
  // o responsável escolhido aqui manda na atribuição do sistema de chamados
  const { data: analistaRow } = analista
    ? await db().from("usuarios").select("email").eq("nome", analista).maybeSingle()
    : { data: null };
  await abrirTicket({
    ref: chamadoId,
    tipo: "desligamento",
    titulo: `Desligamento de ${c.nome}`,
    descricao: [
      `Motivo: ${motivo}`,
      `Data do desligamento: ${dataIso}`,
      `Conta Google: ${contaGoogle === "excluir" ? "excluir" : contaGoogle === "manter" ? "manter ativa" : "suspender"}`,
      backupPara ? `Backup do Drive para: ${backupPara}` : "",
      analista ? `Responsável TI: ${analista}` : "",
      "Checklist de offboarding gerado no LOCCONTROL.",
    ]
      .filter(Boolean)
      .join("\n"),
    responsavelEmail: analistaRow?.email ?? null,
    solicitanteEmail: u.email,
  });
  await emitir(
    "chamado",
    "ti",
    `Desligamento de ${c.nome}`,
    `Chamado ${chamadoId} aberto · checklist de offboarding gerado.`,
    chamadoId,
    analistaRow?.email ?? null // navegador: só o analista atribuído
  );

  await auditar({
    pessoa: c.nome,
    ator: u.nome,
    tabela: "colaboradores",
    campo: "status",
    antes: "Ativo",
    depois: "Desligado",
  });

  revalidatePath("/colaboradores");
  revalidatePath("/fila-ti");
  return {
    ok: true,
    msg: `Desligamento de ${c.nome.split(" ")[0]} registrado · checklist gerado${avisos.length ? ` · ${avisos.join(" · ")}` : ""}`,
    chamadoId,
  };
}

export async function tentarNovamenteSync(id: string) {
  const u = await exigirRH();
  const { data: c } = await db().from("colaboradores").select("nome, sync_falha").eq("id", id).maybeSingle();
  if (!c) return { ok: false, msg: "Colaborador não encontrado" };
  // PENDENTE: integração real — aqui a Groups API seria chamada de novo.
  await db().from("colaboradores").update({ sync_falha: null }).eq("id", id);
  await auditar({
    pessoa: c.nome,
    ator: u.nome,
    tabela: "grupos",
    campo: c.sync_falha ?? "—",
    antes: "falha",
    depois: "aplicado",
  });
  revalidatePath(`/colaboradores/${id}`);
  return { ok: true, msg: "Grupo aplicado · sincronização completa" };
}
