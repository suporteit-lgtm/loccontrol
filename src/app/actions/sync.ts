"use server";

import { db } from "@/lib/db";
import { usuarioAtual, ehAdmin } from "@/lib/session";
import { emitir, acessaUnidade } from "@/lib/notificar";
import * as workspace from "@/services/googleWorkspace";
import { emailPessoalPorCpf } from "@/services/quarkrh";
import { dataBR } from "@/lib/format";
import { agendarEnvio, enviarModelo, ATRASO_POS_LOGIN_MIN, type ChaveModelo } from "@/lib/boasVindas";
import type { Usuario, Colaborador } from "@/lib/types";

/**
 * Sincronização automática com o Google Workspace.
 *
 * Roda sozinha: a interface chama `tick()` a cada 30s. Cada ciclo tem seu
 * próprio intervalo mínimo, porque o custo na API é bem diferente:
 *   · contas e lista de grupos → 1–2 chamadas, pode ser a cada 30s
 *   · membros de todos os grupos → 150+ chamadas, roda a cada 15 min
 * O controle fica na tabela `sync_estado`, então vale para todos os usuários
 * logados ao mesmo tempo (dois navegadores abertos não dobram as chamadas).
 */

/**
 * Cada ciclo tem seu ritmo. Contas e grupos mudam pouco durante o dia e cada
 * verificação custa uma chamada ao Google (~2,5s), então não vale rodar a cada
 * 30s: a tela continua atualizando de 30 em 30s com os dados do banco, que é o
 * que o usuário percebe.
 */
const INTERVALO = {
  contas: 5 * 60_000,
  grupos: 5 * 60_000,
  membros: 30 * 60_000,
  emailPessoal: 15 * 60_000,
};

async function venceu(chave: keyof typeof INTERVALO): Promise<boolean> {
  const { data } = await db().from("sync_estado").select("quando").eq("chave", chave).maybeSingle();
  if (!data) return true;
  return Date.now() - new Date(data.quando).getTime() >= INTERVALO[chave];
}

async function marcar(chave: string, detalhe?: string) {
  await db()
    .from("sync_estado")
    .upsert({ chave, quando: new Date().toISOString(), detalhe: detalhe ?? null });
}

/**
 * Espelha as contas do Workspace em `colaboradores`, sem sobrescrever o que o
 * RH preencheu. Só grava quem realmente mudou — no dia a dia isso costuma ser
 * zero linha, e o ciclo custa uma única chamada ao Google.
 */
async function sincronizarContas(): Promise<number> {
  const r = await workspace.listarUsuarios();
  if (!r.ok) throw new Error(r.erro);
  if (!r.usuarios.length) return 0;

  const { data: existentes } = await db()
    .from("colaboradores")
    .select("id, email, google_id, nome, cargo, dept, telefone, suspenso, ultimo_login");

  const porEmail = new Map(
    (existentes ?? []).filter((c) => c.email).map((c) => [String(c.email).toLowerCase(), c])
  );

  const agora = new Date().toISOString();
  const novos: Record<string, unknown>[] = [];
  const alterados: Record<string, unknown>[] = [];

  for (const u of r.usuarios) {
    const atual = porEmail.get(u.email);

    if (!atual) {
      // conta nova no domínio: entra só com o que o Workspace sabe.
      // cargo, CPF, cidade, unidade, admissão e status ficam em branco.
      novos.push({
        nome: u.nome,
        email: u.email,
        google_id: u.googleId,
        origem: "workspace",
        suspenso: u.suspenso,
        ultimo_login: u.ultimoLogin,
        telefone: u.telefone || null,
        cargo: u.cargo || null,
        dept: u.dept || null,
        status: null,
        cpf: null,
        cidade: null,
        unidade: null,
        grupos: [],
        equipamentos: [],
        sincronizado_em: agora,
      });
      continue;
    }

    // já existe: só o que é espelho do Workspace pode mudar.
    // O que o admin preencheu à mão nunca é sobrescrito.
    const patch: Record<string, unknown> = { id: atual.id };
    let mudou = false;
    const por = (campo: string, de: unknown, para: unknown) => {
      if (de !== para) {
        patch[campo] = para;
        mudou = true;
      }
    };
    // datas precisam ser comparadas como instante: o Postgres devolve
    // "2026-08-11T14:00:00+00:00" e o Google "2026-08-11T14:00:00.000Z"
    const instante = (v: string | null) => (v ? new Date(v).getTime() : 0);
    if (instante(atual.ultimo_login) !== instante(u.ultimoLogin)) {
      patch.ultimo_login = u.ultimoLogin;
      mudou = true;
    }
    por("google_id", atual.google_id, u.googleId);
    por("suspenso", atual.suspenso, u.suspenso);
    if (!atual.nome && u.nome) por("nome", atual.nome, u.nome);
    if (!atual.cargo && u.cargo) por("cargo", atual.cargo, u.cargo);
    if (!atual.dept && u.dept) por("dept", atual.dept, u.dept);
    if (!atual.telefone && u.telefone) por("telefone", atual.telefone, u.telefone);

    if (mudou) {
      patch.sincronizado_em = agora;
      alterados.push(patch);
    }
  }

  for (let i = 0; i < novos.length; i += 200) {
    const { error } = await db().from("colaboradores").insert(novos.slice(i, i + 200));
    if (error) throw new Error(`ao inserir contas: ${error.message}`);
  }

  // UPDATE de verdade (upsert não serve: a validação de NOT NULL acontece antes
  // do ON CONFLICT). Em regime normal são pouquíssimas linhas; no primeiro
  // ciclo podem ser centenas, por isso vão em blocos paralelos.
  const LOTE = 10;
  for (let i = 0; i < alterados.length; i += LOTE) {
    await Promise.all(
      alterados.slice(i, i + LOTE).map(({ id, ...campos }) =>
        db().from("colaboradores").update(campos).eq("id", id as string)
      )
    );
  }

  return novos.length + alterados.length;
}

/** Espelha a lista de grupos (sem membros — isso é do ciclo longo). */
async function sincronizarGrupos(): Promise<number> {
  const r = await workspace.listarGrupos();
  if (!r.ok) throw new Error(r.erro);
  if (!r.grupos.length) return 0;

  const { data: locais } = await db().from("grupos_workspace").select("email, nome");
  const porEmail = new Map((locais ?? []).map((g) => [g.email, g.nome]));

  // só grava o que entrou ou teve o nome alterado
  const novosOuRenomeados = r.grupos.filter((g) => porEmail.get(g.email) !== g.nome);
  if (novosOuRenomeados.length) {
    await db().from("grupos_workspace").upsert(novosOuRenomeados, { onConflict: "email" });
  }

  const doDominio = new Set(r.grupos.map((g) => g.email));
  const sumidos = (locais ?? []).filter((l) => !doDominio.has(l.email)).map((l) => l.email);
  if (sumidos.length) await db().from("grupos_workspace").delete().in("email", sumidos);

  return novosOuRenomeados.length + sumidos.length;
}

/** Espelha os membros de todos os grupos (caro: uma chamada por grupo). */
async function sincronizarMembros(): Promise<number> {
  const r = await workspace.sincronizarGrupos();
  if (!r.ok) throw new Error(r.erro);
  if (!r.grupos.length) return 0;

  const linhas = r.grupos.flatMap((g) =>
    g.membros.map((m) => ({ grupo_email: g.email, nome: m.nome, email: m.email }))
  );
  await db().from("grupo_membros_externos").delete().neq("email", "");
  if (linhas.length) {
    for (let i = 0; i < linhas.length; i += 500) {
      await db().from("grupo_membros_externos").insert(linhas.slice(i, i + 500));
    }
  }
  return linhas.length;
}

/**
 * Completa o e-mail pessoal de quem ficou sem: o dado costuma entrar no Quark
 * DEPOIS de a pré-admissão ser criada aqui (o colaborador preenche o
 * formulário no tempo dele). Só preenche o campo — NÃO dispara e-mail nenhum:
 * as credenciais continuam saindo apenas quando a TI cria a conta.
 */
async function completarEmailPessoal(): Promise<number> {
  const { data } = await db()
    .from("colaboradores")
    .select("id, nome, cpf")
    .in("status", ["Pré-admissão", "Ativo"])
    .is("email_pessoal", null)
    .not("cpf", "is", null)
    .neq("cpf", "—")
    .limit(60);
  const candidatos = data ?? [];
  if (!candidatos.length) return 0;

  let n = 0;
  for (const c of candidatos) {
    // a primeira chamada carrega o quadro do Quark; as demais usam o cache
    const email = await emailPessoalPorCpf(c.cpf as string);
    if (!email) continue;
    await db().from("colaboradores").update({ email_pessoal: email }).eq("id", c.id);
    await db().from("eventos").insert({
      colaborador_id: c.id,
      fase: "pre",
      ator: "Sistema",
      descricao: `E-mail pessoal preenchido do QuarkRH: ${email}`,
    });
    n++;
  }
  return n;
}

/** Avisos de SLA: 24h e 12h antes do prazo de cada chamado (deduplicados por ref). */
async function avisarSla(): Promise<void> {
  const { data: chamados } = await db()
    .from("chamados")
    .select("id, sla_alvo, tipo, analista, colaborador_id, colaboradores(nome, cidade, unidade)")
    .not("sla_alvo", "is", null)
    .is("concluido_em", null)
    .eq("silenciado", false);
  const { data: usuariosTi } = await db().from("usuarios").select("nome, email");
  const emailDe = new Map((usuariosTi ?? []).map((x) => [x.nome, x.email]));
  const agora = Date.now();
  for (const f of chamados ?? []) {
    const destinatario = f.analista ? emailDe.get(f.analista as string) ?? null : null;
    const restante = new Date(f.sla_alvo as string).getTime() - agora;
    if (restante <= 0) continue;
    const colab = (f as { colaboradores?: { nome?: string; cidade?: string | null; unidade?: string | null } })
      .colaboradores;
    const nome = colab?.nome ?? f.id;
    const unidadeRef = colab?.cidade && colab?.unidade ? `${colab.cidade}|${colab.unidade}` : null;
    const dataAlvo = dataBR(f.sla_alvo as string);
    if (restante < 12 * 3600e3) {
      await emitir(
        "sla",
        "ti",
        `SLA em menos de 12h: ${nome}`,
        `O chamado ${f.id} (${f.tipo}) vence em ${dataAlvo}. Menos de 12 horas restantes.`,
        `${f.id}:12h`,
        destinatario,
        undefined,
        unidadeRef
      );
    } else if (restante < 24 * 3600e3) {
      await emitir(
        "sla",
        "ti",
        `SLA em menos de 24h: ${nome}`,
        `O chamado ${f.id} (${f.tipo}) vence em ${dataAlvo}.`,
        `${f.id}:24h`,
        destinatario,
        undefined,
        unidadeRef
      );
    }
  }
}

export interface ResultadoTick {
  ok: boolean;
  mudou: boolean;
  detalhe?: string;
  erro?: string;
}

/**
 * Um ciclo de sincronização. Chamado pela interface a cada 30s.
 * Retorna `mudou: true` quando vale a pena a tela recarregar os dados.
 */
/**
 * Primeiro login detectado → agenda os e-mails do corporativo.
 * A unicidade (colaborador, modelo) no banco garante que só agenda uma vez.
 */
async function agendarPosLogin(): Promise<number> {
  // SÓ quem o RH ativou pelo fluxo (aguarda_boas_vindas) — nunca a base
  // importada. Foi a falta deste filtro que disparou e-mail para 115 pessoas.
  const { data } = await db()
    .from("colaboradores")
    .select("id, nome, cargo, cidade, unidade, email, ultimo_login")
    .eq("status", "Ativo")
    .eq("aguarda_boas_vindas", true)
    .not("email", "is", null)
    .not("ultimo_login", "is", null);

  const candidatos = (data ?? []) as Pick<
    Colaborador,
    "id" | "nome" | "cargo" | "cidade" | "unidade" | "email" | "ultimo_login"
  >[];
  if (!candidatos.length) return 0;

  // quem já tem agendamento não entra de novo
  const { data: jaTem } = await db()
    .from("envios_agendados")
    .select("colaborador_id")
    .in("colaborador_id", candidatos.map((c) => c.id));
  const agendados = new Set((jaTem ?? []).map((e) => e.colaborador_id));

  let n = 0;
  for (const c of candidatos) {
    if (agendados.has(c.id)) continue;
    // "acesso-quark" está fora da automação por ora (falta a URL do portal) —
    // o modelo continua em Configurações, só não é agendado.
    await agendarEnvio(c.id, "boas-vindas", c.email!, ATRASO_POS_LOGIN_MIN);
    await db().from("colaboradores").update({ aguarda_boas_vindas: false }).eq("id", c.id);
    n++;
  }
  return n;
}

/** Envia os e-mails cujo horário já venceu. */
async function despacharEnvios(): Promise<number> {
  const { data } = await db()
    .from("envios_agendados")
    .select("id, modelo, para, tentativas, colaboradores(nome, cargo, cidade, unidade)")
    .is("enviado_em", null)
    .lte("enviar_em", new Date().toISOString())
    .lt("tentativas", 5)
    .limit(20);

  const fila = (data ?? []) as unknown as {
    id: string;
    modelo: ChaveModelo;
    para: string;
    tentativas: number;
    colaboradores: { nome: string; cargo: string | null; cidade: string | null; unidade: string | null } | null;
  }[];

  let enviados = 0;
  for (const e of fila) {
    if (!e.colaboradores) continue;
    const r = await enviarModelo(e.modelo, e.colaboradores, e.para);
    if (r.ok) {
      await db().from("envios_agendados").update({ enviado_em: new Date().toISOString(), erro: null }).eq("id", e.id);
      enviados++;
    } else {
      // falha não some: conta a tentativa e guarda o motivo para diagnóstico
      await db()
        .from("envios_agendados")
        .update({ tentativas: e.tentativas + 1, erro: r.erro ?? "erro desconhecido" })
        .eq("id", e.id);
    }
  }
  return enviados;
}

export async function tick(): Promise<ResultadoTick> {
  const u = await usuarioAtual();
  if (!u) return { ok: false, mudou: false, erro: "sem sessão" };

  const partes: string[] = [];
  try {
    if (await venceu("contas")) {
      await marcar("contas"); // marca antes: evita dois ciclos simultâneos
      const n = await sincronizarContas();
      await marcar("contas", `${n} conta(s)`);
      if (n) partes.push(`${n} conta(s)`);
    }
    if (await venceu("grupos")) {
      await marcar("grupos");
      const n = await sincronizarGrupos();
      await marcar("grupos", `${n} grupo(s)`);
      if (n) partes.push(`${n} grupo(s)`);
    }
    if (await venceu("membros")) {
      await marcar("membros");
      const n = await sincronizarMembros();
      await marcar("membros", `${n} vínculo(s)`);
      if (n) partes.push(`${n} vínculo(s)`);
    }
    if (await venceu("emailPessoal")) {
      await marcar("emailPessoal");
      const n = await completarEmailPessoal();
      await marcar("emailPessoal", `${n} e-mail(s) pessoais`);
      if (n) partes.push(`${n} e-mail(s) pessoal(is) do Quark`);
    }
    await avisarSla();
    await agendarPosLogin();
    const enviados = await despacharEnvios();
    if (enviados) partes.push(`${enviados} e-mail(s)`);
  } catch (e) {
    return { ok: false, mudou: partes.length > 0, erro: (e as Error).message };
  }

  return { ok: true, mudou: partes.length > 0, detalhe: partes.join(" · ") };
}

// ── Entrega no navegador ─────────────────────────────────────────────────────

export interface NotifNavegador {
  id: number;
  titulo: string;
  corpo: string;
}

/** Pelo TIME da pessoa (mesma régua do e-mail em notificar.ts) — veRH/veTI
 *  liberam TELA para qualquer admin e aqui virariam ruído entre os times. */
function alvoDoUsuario(u: Usuario, alvo: string): boolean {
  if (alvo === "todos") return true;
  if (alvo === "admins") return ehAdmin(u.papel);
  if (u.papel === "Superadmin") return true;
  return alvo === "rh"
    ? u.papel === "Usuário RH" || u.papel === "Admin RH"
    : u.papel === "Usuário T.I" || u.papel === "Admin T.I";
}

/**
 * Notificações novas para o usuário logado, respeitando o canal "No sistema"
 * e os toggles por evento de Configurações. `desdeId` é o último id já visto.
 */
export async function novasNotificacoes(desdeId: number): Promise<{ ultimo: number; itens: NotifNavegador[] }> {
  const u = await usuarioAtual();
  if (!u) return { ultimo: desdeId, itens: [] };

  const { data } = await db()
    .from("notificacoes")
    .select("id, tipo, alvo, titulo, corpo, destinatario, unidade")
    .gt("id", desdeId)
    .order("id")
    .limit(20);

  const linhas = data ?? [];
  const ultimo = linhas.length ? Number(linhas[linhas.length - 1].id) : desdeId;
  if (!u.notif?.sistema) return { ultimo, itens: [] };

  return {
    ultimo,
    itens: linhas
      // com destinatário definido, só ele vê a notificação do navegador;
      // com unidade definida, só quem tem acesso àquela base
      .filter(
        (n) =>
          (!n.destinatario || n.destinatario === u.email) &&
          acessaUnidade(u, n.unidade) &&
          alvoDoUsuario(u, n.alvo) &&
          u.notif?.[n.tipo]
      )
      .map((n) => ({ id: Number(n.id), titulo: n.titulo, corpo: n.corpo })),
  };
}

/** Quando foi a última sincronização de cada ciclo (mostrado na tela de Grupos). */
export async function ultimaSync(): Promise<Record<string, string>> {
  const { data } = await db().from("sync_estado").select("chave, quando");
  return Object.fromEntries((data ?? []).map((r) => [r.chave, r.quando]));
}
