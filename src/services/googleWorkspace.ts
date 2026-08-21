// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  Google Workspace Admin SDK — INTEGRAÇÃO REAL                            ║
// ║  Directory API (contas, grupos, membros, sessões) via service account    ║
// ║  com delegação em todo o domínio (ver INTEGRACOES.md).                   ║
// ║                                                                          ║
// ║  Sem GOOGLE_SA_KEY_JSON no .env, cai no MODO MOCK (comportamento         ║
// ║  simulado antigo) — útil para desenvolver sem as chaves.                 ║
// ╚══════════════════════════════════════════════════════════════════════════╝

import { google, type admin_directory_v1 } from "googleapis";
import { randomBytes } from "node:crypto";
import { chaveServico, googleConfigurado } from "@/lib/googleKey";

const SCOPES = [
  "https://www.googleapis.com/auth/admin.directory.user",
  "https://www.googleapis.com/auth/admin.directory.group",
  "https://www.googleapis.com/auth/admin.directory.group.member",
  "https://www.googleapis.com/auth/admin.directory.user.security",
];

const configurado = googleConfigurado;

let _dir: admin_directory_v1.Admin | null = null;

function dir(): admin_directory_v1.Admin {
  if (_dir) return _dir;
  const key = chaveServico();
  const auth = new google.auth.JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: SCOPES,
    subject: process.env.GOOGLE_ADMIN_IMPERSONATE, // delegação: age como este admin
  });
  _dir = google.admin({ version: "directory_v1", auth });
  return _dir;
}

function msgErro(e: unknown): string {
  const err = e as { errors?: { message?: string }[]; message?: string };
  return err?.errors?.[0]?.message ?? err?.message ?? "erro desconhecido na API do Google";
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Contas ───────────────────────────────────────────────────────────────────

/** Cria a conta do colaborador (senha aleatória, troca no primeiro login) e aplica os grupos. */
/**
 * Senha padrão de toda conta nova (provisória: o Google exige troca no
 * primeiro acesso). Vem do ambiente — NUNCA fica no código, que é versionado.
 * Sem a variável, cai numa senha legível gerada por conta.
 */
export function senhaPadrao(): string {
  return process.env.SENHA_PADRAO_CONTA || `Loc@${randomBytes(3).readUIntBE(0, 3) % 90000 + 10000}`;
}

function senhaProvisoria(): string {
  return senhaPadrao();
}

/** A conta já existe no Workspace? Usado para avisar a TI antes de confirmar. */
export async function contaExiste(email: string): Promise<boolean> {
  if (!configurado()) return false;
  try {
    await dir().users.get({ userKey: email });
    return true;
  } catch {
    return false; // 404 (não existe) ou indisponível — trata como "não existe"
  }
}

export async function criarConta(
  email: string,
  nome: string,
  grupos: string[]
): Promise<{ ok: boolean; erro?: string; senha?: string; jaExistia?: boolean }> {
  const senha = senhaProvisoria();
  if (!configurado()) {
    await delay(400); // MOCK
    return { ok: true, senha };
  }
  let jaExistia = false;
  const partes = nome.trim().split(/\s+/);
  try {
    await dir().users.insert({
      requestBody: {
        primaryEmail: email,
        name: {
          givenName: partes[0],
          familyName: partes.slice(1).join(" ") || partes[0],
        },
        password: senha,
        changePasswordAtNextLogin: true,
      },
    });
  } catch (e) {
    const m = msgErro(e);
    // conta já existe (criada direto no Workspace) → não é erro: apenas
    // vincula, aplica os grupos e avisa quem chamou para não prometer senha
    if (!/already exists|duplicate|entity already/i.test(m)) return { ok: false, erro: m };
    jaExistia = true;
  }
  for (const g of grupos) {
    const r = await adicionarMembro(g, email);
    if (!r.ok && r.erro && !/already exists|duplicate|member already/i.test(r.erro))
      return { ok: false, erro: `grupo ${g}: ${r.erro}` };
  }
  // conta preexistente mantém a senha que já tinha — não inventar uma nova
  return { ok: true, jaExistia, senha: jaExistia ? undefined : senha };
}

// ── Grupos e membros (Groups API) ────────────────────────────────────────────

export async function adicionarMembro(
  grupo: string,
  email: string
): Promise<{ ok: boolean; erro?: string }> {
  if (!configurado()) {
    await delay(200); // MOCK
    return { ok: true };
  }
  try {
    await dir().members.insert({ groupKey: grupo, requestBody: { email, role: "MEMBER" } });
    return { ok: true };
  } catch (e) {
    const m = msgErro(e);
    if (/already exists|duplicate|member already/i.test(m)) return { ok: true };
    return { ok: false, erro: m };
  }
}

export async function removerMembros(
  grupo: string,
  emails: string[]
): Promise<{ ok: boolean; erro?: string }> {
  if (!configurado()) {
    await delay(200); // MOCK
    return { ok: true };
  }
  for (const email of emails) {
    try {
      await dir().members.delete({ groupKey: grupo, memberKey: email });
    } catch (e) {
      const m = msgErro(e);
      if (!/not found|resource not found/i.test(m)) return { ok: false, erro: `${email}: ${m}` };
    }
  }
  return { ok: true };
}

export async function criarGrupo(nome: string, email: string): Promise<{ ok: boolean; erro?: string }> {
  if (!configurado()) {
    await delay(300); // MOCK
    return { ok: true };
  }
  try {
    await dir().groups.insert({ requestBody: { name: nome, email } });
    return { ok: true };
  } catch (e) {
    const m = msgErro(e);
    if (/already exists|duplicate/i.test(m)) return { ok: true };
    return { ok: false, erro: m };
  }
}

export async function excluirGrupo(email: string): Promise<{ ok: boolean; erro?: string }> {
  if (!configurado()) {
    await delay(300); // MOCK
    return { ok: true };
  }
  try {
    await dir().groups.delete({ groupKey: email });
    return { ok: true };
  } catch (e) {
    const m = msgErro(e);
    if (/not found/i.test(m)) return { ok: true };
    return { ok: false, erro: m };
  }
}

// ── Desligamento: suspender/excluir conta e backup do Drive ──────────────────

/** Suspende a conta (login bloqueado, dados preservados). */
export async function suspenderConta(email: string): Promise<{ ok: boolean; erro?: string }> {
  if (!configurado()) {
    await delay(300); // MOCK
    return { ok: true };
  }
  try {
    await dir().users.update({ userKey: email, requestBody: { suspended: true } });
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: msgErro(e) };
  }
}

/** Exclui a conta definitivamente (recuperável por até 20 dias no console). */
export async function excluirConta(email: string): Promise<{ ok: boolean; erro?: string }> {
  if (!configurado()) {
    await delay(300); // MOCK
    return { ok: true };
  }
  try {
    await dir().users.delete({ userKey: email });
    return { ok: true };
  } catch (e) {
    const m = msgErro(e);
    if (/not found/i.test(m)) return { ok: true }; // já não existia
    return { ok: false, erro: m };
  }
}

/**
 * Transfere os arquivos do Drive para outro usuário (Data Transfer API) —
 * o mesmo "fazer backup" do fluxo de exclusão do console do Google.
 * Requer o escopo admin.datatransfer autorizado na delegação.
 */
export async function transferirDrive(
  emailOrigem: string,
  emailDestino: string
): Promise<{ ok: boolean; erro?: string }> {
  if (!configurado()) {
    await delay(400); // MOCK
    return { ok: true };
  }
  try {
    const key = chaveServico();
    // cliente próprio: se o escopo ainda não foi autorizado no admin console,
    // só esta função falha — o resto da integração continua funcionando
    const auth = new google.auth.JWT({
      email: key.client_email,
      key: key.private_key,
      scopes: [
        "https://www.googleapis.com/auth/admin.datatransfer",
        "https://www.googleapis.com/auth/admin.directory.user",
      ],
      subject: process.env.GOOGLE_ADMIN_IMPERSONATE,
    });
    const dt = google.admin({ version: "datatransfer_v1", auth });
    const dirLocal = google.admin({ version: "directory_v1", auth });

    const [origem, destino, apps] = await Promise.all([
      dirLocal.users.get({ userKey: emailOrigem }),
      dirLocal.users.get({ userKey: emailDestino }),
      dt.applications.list({ customerId: "my_customer" }),
    ]);
    const drive = (apps.data.applications ?? []).find((a) => /drive/i.test(a.name ?? ""));
    if (!drive?.id) return { ok: false, erro: "aplicação Drive não encontrada na Data Transfer API" };
    if (!origem.data.id || !destino.data.id) return { ok: false, erro: "usuário de origem ou destino não encontrado" };

    await dt.transfers.insert({
      requestBody: {
        oldOwnerUserId: origem.data.id,
        newOwnerUserId: destino.data.id,
        applicationDataTransfers: [
          {
            applicationId: drive.id,
            applicationTransferParams: [{ key: "PRIVACY_LEVEL", value: ["PRIVATE", "SHARED"] }],
          },
        ],
      },
    });
    return { ok: true };
  } catch (e) {
    const m = msgErro(e);
    if (/unauthorized|not authorized|insufficient/i.test(m))
      return {
        ok: false,
        erro:
          "escopo admin.datatransfer ainda não autorizado — adicione https://www.googleapis.com/auth/admin.datatransfer na delegação do admin console",
      };
    return { ok: false, erro: m };
  }
}

// ── Bloqueio de emergência (área restrita) ───────────────────────────────────

export type PassoPanico = "senha" | "recuperacao" | "sessoes";

const tentativasMock = new Map<string, number>();

/**
 * Executa um passo do bloqueio de emergência:
 *  senha       → substitui a senha por uma sequência aleatória
 *  recuperacao → remove e-mail e telefone de recuperação
 *  sessoes     → encerra todas as sessões em todos os dispositivos
 */
export async function executarPassoPanico(
  alvoEmail: string,
  passo: PassoPanico
): Promise<{ ok: boolean; erro?: string }> {
  if (!configurado()) {
    await delay(900); // MOCK: o passo "recuperacao" falha na 1ª tentativa
    if (passo === "recuperacao") {
      const chave = `${alvoEmail}:recuperacao`;
      const n = (tentativasMock.get(chave) ?? 0) + 1;
      tentativasMock.set(chave, n);
      if (n === 1) return { ok: false, erro: "Falha temporária na API do Workspace" };
    }
    return { ok: true };
  }
  if (!alvoEmail.includes("@")) return { ok: false, erro: "Colaborador sem e-mail corporativo" };
  try {
    if (passo === "senha") {
      await dir().users.update({
        userKey: alvoEmail,
        requestBody: {
          password: randomBytes(32).toString("base64url"),
          changePasswordAtNextLogin: false,
        },
      });
    } else if (passo === "recuperacao") {
      await dir().users.update({
        userKey: alvoEmail,
        requestBody: { recoveryEmail: "", recoveryPhone: "" },
      });
    } else {
      await dir().users.signOut({ userKey: alvoEmail });
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: msgErro(e) };
  }
}

// ── Usuários do domínio ──────────────────────────────────────────────────────

export interface UsuarioWorkspace {
  googleId: string;
  nome: string;
  email: string;
  suspenso: boolean;
  ultimoLogin: string | null;
  criadoEm: string | null;
  cargo: string; // organizations[0].title — normalmente vazio no domínio
  dept: string; // organizations[0].department
  telefone: string;
}

/** Lista todas as contas de @locgrupo.com.br (1 chamada por 500 contas). */
export async function listarUsuarios(): Promise<{ ok: boolean; usuarios: UsuarioWorkspace[]; erro?: string }> {
  if (!configurado()) {
    await delay(300); // MOCK
    return { ok: true, usuarios: [] };
  }
  try {
    const usuarios: UsuarioWorkspace[] = [];
    let pageToken: string | undefined;
    do {
      const r = await dir().users.list({
        domain: "locgrupo.com.br",
        maxResults: 500,
        orderBy: "email",
        pageToken,
      });
      for (const u of r.data.users ?? []) {
        if (!u.primaryEmail || !u.id) continue;
        const org = u.organizations?.[0];
        usuarios.push({
          googleId: u.id,
          nome: u.name?.fullName?.trim() || u.primaryEmail.split("@")[0],
          email: u.primaryEmail.toLowerCase(),
          suspenso: !!u.suspended,
          ultimoLogin: u.lastLoginTime && !u.lastLoginTime.startsWith("1970") ? u.lastLoginTime : null,
          criadoEm: u.creationTime ?? null,
          cargo: (org?.title ?? "").trim(),
          dept: (org?.department ?? "").trim(),
          telefone: (u.phones?.[0]?.value ?? "").trim(),
        });
      }
      pageToken = r.data.nextPageToken ?? undefined;
    } while (pageToken);
    return { ok: true, usuarios };
  } catch (e) {
    return { ok: false, usuarios: [], erro: msgErro(e) };
  }
}

/** Só a lista de grupos (sem membros) — barata, serve para o ciclo curto. */
export async function listarGrupos(): Promise<{ ok: boolean; grupos: { nome: string; email: string }[]; erro?: string }> {
  if (!configurado()) {
    await delay(200); // MOCK
    return { ok: true, grupos: [] };
  }
  try {
    const grupos: { nome: string; email: string }[] = [];
    let pageToken: string | undefined;
    do {
      const r = await dir().groups.list({ domain: "locgrupo.com.br", maxResults: 200, pageToken });
      for (const g of r.data.groups ?? []) {
        if (!g.email || !g.email.toLowerCase().endsWith("@locgrupo.com.br")) continue;
        grupos.push({ nome: g.name ?? g.email, email: g.email.toLowerCase() });
      }
      pageToken = r.data.nextPageToken ?? undefined;
    } while (pageToken);
    return { ok: true, grupos };
  } catch (e) {
    return { ok: false, grupos: [], erro: msgErro(e) };
  }
}

// ── Sincronização do espelho de grupos ───────────────────────────────────────

export interface GrupoSync {
  nome: string;
  email: string;
  membros: { email: string; nome: string }[];
}

/** Membros de um grupo (todas as páginas). */
async function membrosDoGrupo(email: string): Promise<GrupoSync["membros"]> {
  const membros: GrupoSync["membros"] = [];
  let pageToken: string | undefined;
  do {
    const mr = await dir().members.list({ groupKey: email, maxResults: 200, pageToken });
    for (const m of mr.data.members ?? []) {
      if (!m.email) continue;
      const nome = m.email
        .split("@")[0]
        .split(".")
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join(" ");
      membros.push({ email: m.email.toLowerCase(), nome });
    }
    pageToken = mr.data.nextPageToken ?? undefined;
  } while (pageToken);
  return membros;
}

/**
 * Todos os grupos do domínio com seus membros (espelho local).
 * São ~150 grupos: as consultas de membros vão em blocos paralelos para o
 * ciclo não levar minutos — a API do Google aguenta essa concorrência.
 */
export async function sincronizarGrupos(): Promise<{
  ok: boolean;
  quando: string;
  grupos: GrupoSync[];
  erro?: string;
}> {
  const quando = new Date().toISOString();
  if (!configurado()) {
    await delay(500); // MOCK
    return { ok: true, quando, grupos: [] };
  }
  try {
    const lista = await listarGrupos();
    if (!lista.ok) throw new Error(lista.erro);

    const grupos: GrupoSync[] = [];
    const LOTE = 10;
    for (let i = 0; i < lista.grupos.length; i += LOTE) {
      const bloco = lista.grupos.slice(i, i + LOTE);
      const resultados = await Promise.all(
        bloco.map(async (g) => ({
          nome: g.nome,
          email: g.email,
          membros: await membrosDoGrupo(g.email).catch(() => [] as GrupoSync["membros"]),
        }))
      );
      grupos.push(...resultados);
    }
    return { ok: true, quando, grupos };
  } catch (e) {
    return { ok: false, quando, grupos: [], erro: msgErro(e) };
  }
}
