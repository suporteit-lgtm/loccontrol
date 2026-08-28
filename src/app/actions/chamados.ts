"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { exigirSessao, exigirTI, exigirAdmin, ehAdmin } from "@/lib/perms";
import { auditar } from "@/lib/audit";
import { arquivarChamado } from "@/lib/data";
import { primeiroNome } from "@/lib/format";
import * as workspace from "@/services/googleWorkspace";
import { notificarConclusao, atualizarTicket } from "@/services/tickets";
import { emitir } from "@/lib/notificar";
import { enviarModelo } from "@/lib/boasVindas";
import type { Chamado, Colaborador } from "@/lib/types";

function revalidarFilas() {
  revalidatePath("/fila-ti");
  revalidatePath("/fila-rh");
  revalidatePath("/dash");
  revalidatePath("/dash-ti");
}

export async function silenciarChamado(id: string) {
  await exigirTI();
  const { data: f } = await db().from("chamados").select("*, colaboradores(nome)").eq("id", id).maybeSingle();
  if (!f) return { ok: false, msg: "Chamado não encontrado" };
  await db().from("chamados").update({ silenciado: true }).eq("id", id);
  await atualizarTicket(id, "pausado", "Alertas silenciados no LOCCONTROL (pré-concluído)");
  revalidarFilas();
  const nome = (f as { colaboradores?: { nome: string } }).colaboradores?.nome;
  return { ok: true, msg: `Alertas silenciados${nome ? ` para ${primeiroNome(nome)}` : ""}` };
}

export async function reativarChamado(id: string) {
  await exigirTI();
  await db().from("chamados").update({ silenciado: false }).eq("id", id);
  await atualizarTicket(id, "em_andamento", "Alertas reativados no LOCCONTROL");
  revalidarFilas();
  return { ok: true, msg: "Alertas reativados" };
}

/** Executa uma solicitação de cidade/unidade (somente admins). */
export async function executarSolicitacaoUnidade(chamadoId: string) {
  const u = await exigirAdmin();
  const { data: f } = await db().from("chamados").select("*").eq("id", chamadoId).maybeSingle();
  const ch = f as Chamado | null;
  if (!ch?.payload || !("acao" in ch.payload)) return { ok: false, msg: "Solicitação não encontrada" };
  const { acao, cidade, unidade } = ch.payload;

  let msg = "";
  if (acao === "add-cidade") {
    const { data: existe } = await db().from("cidades").select("id").eq("nome", cidade).maybeSingle();
    if (!existe) {
      const { data: nova } = await db().from("cidades").insert({ nome: cidade }).select("id").single();
      if (nova) await db().from("unidades").insert({ cidade_id: nova.id, nome: "Centro" });
    }
    msg = `Cidade ${cidade} adicionada com a unidade Centro`;
  } else if (acao === "del-cidade") {
    await db().from("cidades").delete().eq("nome", cidade);
    // remove também solicitações pendentes ligadas à cidade
    const { data: pend } = await db().from("chamados").select("id, payload").not("payload", "is", null).is("concluido_em", null);
    for (const p of pend ?? []) {
      const pl = p.payload as { cidade?: string } | null;
      if (pl?.cidade === cidade && p.id !== chamadoId) await arquivarChamado(p.id, "cancelado", `${u.nome} (cidade removida)`);
    }
    msg = `Cidade ${cidade} removida`;
  } else if (acao === "add-unid" && unidade) {
    const { data: cid } = await db().from("cidades").select("id").eq("nome", cidade).maybeSingle();
    if (cid) await db().from("unidades").upsert({ cidade_id: cid.id, nome: unidade }, { onConflict: "cidade_id,nome" });
    msg = `Unidade ${unidade} adicionada em ${cidade}`;
  } else if (acao === "del-unid" && unidade) {
    const { data: cid } = await db().from("cidades").select("id").eq("nome", cidade).maybeSingle();
    if (cid) await db().from("unidades").delete().eq("cidade_id", cid.id).eq("nome", unidade);
    msg = `Unidade ${unidade} removida de ${cidade}`;
  }

  await arquivarChamado(chamadoId, "concluido", u.nome);
  await atualizarTicket(chamadoId, "concluido", `Aprovado e executado por ${u.nome}`);
  await auditar({
    ator: u.nome,
    tabela: "unidades",
    campo: unidade ? `${cidade} · ${unidade}` : cidade,
    antes: "solicitado",
    depois: acao.startsWith("add") ? "criado" : "removido",
  });
  revalidarFilas();
  revalidatePath("/unidades");
  return { ok: true, msg };
}

/** Executa uma solicitação de grupo (criação/exclusão) — TI. */
export async function executarSolicitacaoGrupo(chamadoId: string) {
  const u = await exigirTI();
  const { data: f } = await db().from("chamados").select("*").eq("id", chamadoId).maybeSingle();
  const ch = f as Chamado | null;
  if (!ch?.payload || !("gTipo" in ch.payload)) return { ok: false, msg: "Solicitação não encontrada" };
  const { gTipo, nome, email } = ch.payload;

  if (gTipo === "criacao") {
    const r = await workspace.criarGrupo(nome || email, email);
    if (!r.ok) return { ok: false, msg: `Workspace: ${r.erro}` };
    await db().from("grupos_workspace").upsert({ nome: nome || email, email }, { onConflict: "email" });
  } else {
    const r = await workspace.excluirGrupo(email);
    if (!r.ok) return { ok: false, msg: `Workspace: ${r.erro}` };
    await db().from("grupos_workspace").delete().eq("email", email);
  }
  await arquivarChamado(chamadoId, "concluido", u.nome);
  await atualizarTicket(chamadoId, "concluido", `Grupo ${email} ${gTipo === "criacao" ? "criado" : "excluído"} por ${u.nome}`);
  await auditar({
    ator: u.nome,
    tabela: "grupos",
    campo: email,
    antes: gTipo === "criacao" ? "—" : "ativo",
    depois: gTipo === "criacao" ? "criado" : "excluído",
  });
  revalidarFilas();
  revalidatePath("/grupos");
  return { ok: true, msg: gTipo === "criacao" ? `Grupo ${email} criado` : `Grupo ${email} excluído` };
}

/** Exclui (cancela) um chamado de admissão/desligamento direto da fila da TI.
 *  Se a TI já tinha criado o e-mail da admissão, a conta sai junto do
 *  Workspace — colaborador nunca ativado não pode ficar com conta órfã. */
export async function excluirChamado(chamadoId: string) {
  const u = await exigirTI();
  const { data: f } = await db()
    .from("chamados")
    .select("id, tipo, concluido_em, colaborador_id, colaboradores(nome, email, status)")
    .eq("id", chamadoId)
    .maybeSingle();
  if (!f) return { ok: false, msg: "Chamado não encontrado" };
  if (f.concluido_em) return { ok: false, msg: "Este chamado já foi concluído" };

  const colab = (f as { colaboradores?: { nome?: string; email?: string | null; status?: string | null } })
    .colaboradores;
  const nome = colab?.nome;

  // só a conta de uma ADMISSÃO ainda não ativada — jamais a de alguém Ativo
  // (desligamento tem fluxo próprio, com backup do Drive)
  const avisos: string[] = [];
  if (f.tipo === "Admissão" && colab?.email && colab.status !== "Ativo" && f.colaborador_id) {
    const noWorkspace = await workspace.contaExiste(colab.email);
    if (noWorkspace) {
      const r = await workspace.excluirConta(colab.email);
      if (!r.ok) return { ok: false, msg: `Conta Google: ${r.erro} — o chamado não foi excluído` };
      avisos.push(`conta ${colab.email} excluída do Workspace`);
    } else {
      avisos.push(`a conta ${colab.email} não está no Workspace — se foi criada no webmail externo, exclua lá também`);
    }
    await db().from("envios_agendados").delete().eq("colaborador_id", f.colaborador_id);
    await db()
      .from("colaboradores")
      .update({ email: null, google_id: null, aguarda_boas_vindas: false })
      .eq("id", f.colaborador_id);
    await db().from("eventos").insert({
      colaborador_id: f.colaborador_id,
      fase: "pre",
      ator: `${u.nome} · TI`,
      descricao: `Chamado ${chamadoId} excluído · ${avisos.join(" · ")}`,
    });
  }

  await arquivarChamado(chamadoId, "cancelado", u.nome);
  await atualizarTicket(chamadoId, "cancelado", `Chamado excluído por ${u.nome} na fila da TI`);
  await auditar({
    pessoa: nome ?? chamadoId,
    ator: u.nome,
    tabela: "chamados",
    campo: chamadoId,
    antes: "na fila da TI",
    depois: `excluído${avisos.length ? ` · ${avisos[0]}` : ""}`,
  });
  revalidarFilas();
  return {
    ok: true,
    msg: `Chamado ${chamadoId}${nome ? ` (${nome})` : ""} excluído${avisos.length ? ` · ${avisos.join(" · ")}` : ""}`,
  };
}

export async function negarSolicitacao(chamadoId: string) {
  const u = await exigirSessao();
  const { data: f } = await db().from("chamados").select("*").eq("id", chamadoId).maybeSingle();
  const ch = f as Chamado | null;
  if (!ch) return { ok: false, msg: "Solicitação não encontrada" };
  const pl = ch.payload;
  const ehGrupoExcl = pl && "gTipo" in pl && pl.gTipo === "exclusao";
  if (!ehGrupoExcl && !ehAdmin(u.papel)) return { ok: false, msg: "Apenas administradores podem negar este pedido" };

  await arquivarChamado(chamadoId, "negado", u.nome);
  await atualizarTicket(chamadoId, "cancelado", `Pedido negado por ${u.nome}`);
  if (pl && "gTipo" in pl) {
    await auditar({
      ator: u.nome,
      tabela: "chamados",
      campo: pl.email,
      antes: pl.gTipo === "exclusao" ? "exclusão solicitada" : "criação solicitada",
      depois: "pedido negado",
    });
    revalidarFilas();
    revalidatePath("/grupos");
    return { ok: true, msg: `Pedido ${chamadoId} negado · grupo ${pl.email} mantido` };
  }
  revalidarFilas();
  revalidatePath("/unidades");
  return { ok: true, msg: `Pedido ${chamadoId} negado` };
}

/**
 * Diz o que vai acontecer com o e-mail informado, antes de a TI confirmar:
 * a conta pode já existir no Workspace e/ou já ter sido importada como um
 * segundo registro de colaborador (o que antes travava a gravação).
 */
export async function verificarEmail(email: string, colabId: string) {
  await exigirTI();
  const alvo = email.trim().toLowerCase();
  if (!alvo.includes("@")) return { existeWorkspace: false, duplicado: null as string | null };

  const [noGoogle, { data: outro }] = await Promise.all([
    workspace.contaExiste(alvo),
    db().from("colaboradores").select("id, nome, origem").eq("email", alvo).neq("id", colabId).maybeSingle(),
  ]);

  return {
    existeWorkspace: noGoogle,
    duplicado: outro ? `${outro.nome}${outro.origem === "workspace" ? " (importado do Workspace)" : ""}` : null,
  };
}

/**
 * Funde o registro importado do Workspace na pré-admissão: a ficha do RH é a
 * que vale (cargo, unidade, acessos), e dela herdamos só o que o Google sabe.
 */
async function absorverDuplicado(colabId: string, email: string): Promise<string | null> {
  const { data: outro } = await db()
    .from("colaboradores")
    .select("id, google_id, ultimo_login, suspenso")
    .eq("email", email)
    .neq("id", colabId)
    .maybeSingle();
  if (!outro) return null;

  await db().from("eventos").update({ colaborador_id: colabId }).eq("colaborador_id", outro.id);
  await db().from("colaboradores").delete().eq("id", outro.id);
  await db()
    .from("colaboradores")
    .update({ google_id: outro.google_id, ultimo_login: outro.ultimo_login, suspenso: outro.suspenso })
    .eq("id", colabId);
  return outro.id;
}

/** Ativação do colaborador a partir do chamado de admissão. */
export async function ativarColaborador(
  chamadoId: string,
  email: string,
  grupos?: string[],
  apenasRegistrar = false
) {
  const u = await exigirTI();
  const { data: f } = await db().from("chamados").select("*").eq("id", chamadoId).maybeSingle();
  const ch = f as Chamado | null;
  if (!ch?.colaborador_id) return { ok: false as const, msg: "Chamado não encontrado" };
  const { data: c } = await db().from("colaboradores").select("*").eq("id", ch.colaborador_id).maybeSingle();
  if (!c) return { ok: false as const, msg: "Colaborador não encontrado" };
  if (!email.includes("@")) return { ok: false as const, msg: "Informe um e-mail válido" };

  const alvo = email.trim().toLowerCase();

  // A TI pode ter ajustado os grupos na tela; se ajustou, é essa lista que vale
  const grupoFinal = grupos ?? c.grupos ?? [];
  if (grupos) await db().from("colaboradores").update({ grupos }).eq("id", c.id);

  // "apenasRegistrar": a conta foi criada fora do Workspace — nada é criado
  // nem grupo aplicado aqui, o endereço só fica registrado na ficha.
  const conta = apenasRegistrar
    ? { ok: true as const, jaExistia: true, senha: undefined }
    : await workspace.criarConta(alvo, c.nome, grupoFinal);
  if (!conta.ok) return { ok: false as const, msg: `Workspace: ${conta.erro}` };

  // Se a conta já tinha sido importada como um segundo registro, funde os dois
  // antes de gravar — é o que impedia salvar o e-mail na ficha do colaborador.
  const fundido = await absorverDuplicado(c.id, alvo);

  // A TI só entrega a conta e os acessos — quem ativa na empresa é o RH.
  await db().from("colaboradores").update({ email: alvo, sync_falha: null }).eq("id", c.id);

  // Credenciais no e-mail PESSOAL: é o único canal que a pessoa consegue ler
  // antes de entrar na conta nova pela primeira vez.
  const colab = c as Colaborador;
  let entrega = "sem e-mail pessoal cadastrado — entregue as credenciais manualmente";
  if (colab.email_pessoal) {
    // conta externa: mesmas credenciais (senha padrão), muda só a forma de
    // entrar — o modelo "credenciais-externo" traz o link do webmail
    const r = await enviarModelo(
      apenasRegistrar ? "credenciais-externo" : "credenciais",
      colab,
      colab.email_pessoal,
      { email: alvo, senha: apenasRegistrar ? workspace.senhaPadrao() : conta.senha ?? "(definida no Workspace)" }
    );
    entrega = r.ok
      ? `credenciais${apenasRegistrar ? " (webmail)" : ""} enviadas para ${colab.email_pessoal}`
      : `credenciais NÃO enviadas (${r.erro})`;
  }

  await db().from("eventos").insert({
    colaborador_id: c.id,
    fase: "pre",
    ator: `${u.nome} · TI`,
    descricao: apenasRegistrar
      ? `E-mail ${alvo} registrado (conta criada fora do Workspace) · grupos NÃO aplicados automaticamente${
          fundido ? " · registro duplicado do Workspace fundido nesta ficha" : ""
        } · ${entrega}`
      : `Conta ${alvo} ${conta.jaExistia ? "vinculada (já existia no Workspace)" : "criada"} · grupos e acessos aplicados${
          fundido ? " · registro duplicado do Workspace fundido nesta ficha" : ""
        } · ${entrega}`,
  });

  // Devolve ao RH: a conta saiu, o endereço é este, falta ativar.
  // Navegador: só quem abriu o chamado (solicitante); e-mail segue por time.
  const { data: quemAbriu } = ch.solicitante
    ? await db().from("usuarios").select("email").eq("nome", ch.solicitante).maybeSingle()
    : { data: null };
  await emitir(
    "pre",
    "rh",
    `Pronto para ativar: ${primeiroNome(c.nome)}`,
    apenasRegistrar
      ? `A TI concluiu ${c.nome} — o e-mail ${alvo} foi registrado (conta criada fora do Workspace). Falta o RH ativar na empresa (Fila do RH).`
      : `A TI concluiu ${c.nome} — a conta ${alvo} está pronta e os grupos aplicados. Falta o RH ativar na empresa (Fila do RH).`,
    `conta-${chamadoId}`,
    quemAbriu?.email ?? null,
    undefined,
    c.cidade && c.unidade ? `${c.cidade}|${c.unidade}` : null
  );

  // Criar a conta é só UMA parte do trabalho da TI — o chamado segue aberto
  // (acessos, equipamentos). Concluir é ação separada, ou vem da ferramenta.
  await atualizarTicket(
    chamadoId,
    "em_andamento",
    `Conta ${alvo} ${apenasRegistrar ? "registrada" : "criada"} por ${u.nome} — chamado segue aberto`
  );

  await auditar({
    pessoa: c.nome,
    ator: u.nome,
    tabela: "colaboradores",
    campo: "e-mail corporativo",
    depois: alvo,
  });

  revalidarFilas();
  revalidatePath(`/colaboradores/${c.id}`);
  return {
    ok: true as const,
    msg: apenasRegistrar
      ? `E-mail de ${primeiroNome(c.nome)} registrado · RH avisado · o chamado segue aberto`
      : `Conta de ${primeiroNome(c.nome)} criada · RH avisado · o chamado segue aberto`,
    colabId: c.id,
  };
}

/** Encerra o chamado de admissão — quando a TI terminou TUDO (conta, acessos, equipamentos). */
export async function concluirChamado(chamadoId: string) {
  const u = await exigirTI();
  const { data: f } = await db()
    .from("chamados")
    .select("id, tipo, concluido_em, colaboradores(nome, email)")
    .eq("id", chamadoId)
    .maybeSingle();
  if (!f) return { ok: false as const, msg: "Chamado não encontrado" };
  if (f.concluido_em) return { ok: false as const, msg: "Este chamado já foi concluído" };

  const colab = (f as { colaboradores?: { nome?: string; email?: string | null } }).colaboradores;
  if (f.tipo === "Admissão" && !colab?.email)
    return { ok: false as const, msg: "Informe o e-mail corporativo antes de concluir o chamado" };

  await arquivarChamado(chamadoId, "concluido", u.nome);
  await notificarConclusao(chamadoId);
  await auditar({
    pessoa: colab?.nome ?? chamadoId,
    ator: u.nome,
    tabela: "chamados",
    campo: chamadoId,
    antes: "na fila da TI",
    depois: "concluído",
  });
  revalidarFilas();
  return { ok: true as const, msg: `Chamado ${chamadoId} concluído` };
}
