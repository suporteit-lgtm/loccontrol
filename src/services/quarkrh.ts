// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  QuarkRH — INTEGRAÇÃO REAL (somente leitura)                             ║
// ║  API "Extrator": https://api.quark.tec.br/v1/...                         ║
// ║  Autenticação por header `Auth-token`; a unidade vai em `Unidade-Id`.    ║
// ║                                                                          ║
// ║  A API NÃO tem busca por CPF — só lista colaboradores por unidade        ║
// ║  (paginada, 100 por página). Por isso o serviço carrega o quadro das     ║
// ║  unidades em paralelo, mantém em cache por alguns minutos e filtra       ║
// ║  localmente por CPF ou nome.                                             ║
// ║                                                                          ║
// ║  Sem QUARKRH_TOKEN no .env, cai no MODO MOCK.                            ║
// ╚══════════════════════════════════════════════════════════════════════════╝

export interface PreAdmissaoQuark {
  quarkId: number;
  nome: string;
  cpf: string; // formatado 000.000.000-00
  admissao: string; // dd/mm/aaaa
  cargo: string;
  dept: string;
  telefone: string;
  email: string;
  emailCorporativo: string;
  unidadeQuark: string;
  desligado: boolean;
}

function baseUrl() {
  return (process.env.QUARKRH_BASE_URL || "https://api.quark.tec.br").replace(/\/$/, "");
}

function configurado(): boolean {
  return !!process.env.QUARKRH_TOKEN;
}

/**
 * A API recusa requisições concorrentes com 429 — as chamadas são sequenciais
 * (rápidas: ~100ms cada) e ainda repetem com espera crescente se der 429.
 */
async function api<T>(caminho: string, unidadeId?: number): Promise<T> {
  const headers: Record<string, string> = { "Auth-token": process.env.QUARKRH_TOKEN! };
  if (unidadeId) headers["Unidade-Id"] = String(unidadeId);

  for (let tentativa = 0; tentativa < 4; tentativa++) {
    const r = await fetch(`${baseUrl()}${caminho}`, { headers, redirect: "follow", cache: "no-store" });
    if (r.ok) return (await r.json()) as T;
    if (r.status === 429) {
      const espera = Number(r.headers.get("retry-after")) * 1000 || 600 * (tentativa + 1);
      await new Promise((res) => setTimeout(res, espera));
      continue;
    }
    if (r.status === 401 || r.status === 403) throw new Error("token do QuarkRH inválido ou sem permissão");
    throw new Error(`QuarkRH respondeu ${r.status} em ${caminho}`);
  }
  throw new Error("QuarkRH recusou as requisições (limite de uso) — tente de novo em instantes");
}

// ── Normalização ─────────────────────────────────────────────────────────────

/** O CPF vem como número — zeros à esquerda somem. Repõe e formata. */
function formatarCpf(cpfCnpj: number | string | null): string {
  if (!cpfCnpj) return "";
  const d = String(cpfCnpj).replace(/\D/g, "").padStart(11, "0");
  if (d.length !== 11) return String(cpfCnpj);
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function soDigitos(v: string): string {
  return v.replace(/\D/g, "");
}

/** Datas vêm em epoch (ms). */
function dataBRdeEpoch(ms: number | null): string {
  if (!ms) return "";
  const d = new Date(ms);
  if (isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

interface ColabQuark {
  id: number;
  cargo?: { denominacao?: string } | null;
  funcao?: { denominacao?: string } | null;
  equipe?: { denominacao?: string } | null;
  dataAdmissao?: number | null;
  dataDesligamento?: number | null;
  ativo?: boolean;
  pessoa?: {
    nome?: string;
    cpfCnpj?: number | string | null;
    email?: string | null;
    emailCorporativo?: string | null;
    telefoneCelular?: string | null;
    telefoneFixo?: string | null;
  } | null;
}

function mapear(c: ColabQuark, unidadeNome: string): PreAdmissaoQuark {
  const p = c.pessoa ?? {};
  return {
    quarkId: c.id,
    nome: (p.nome ?? "").trim(),
    cpf: formatarCpf(p.cpfCnpj ?? null),
    admissao: dataBRdeEpoch(c.dataAdmissao ?? null),
    cargo: c.cargo?.denominacao?.trim() ?? c.funcao?.denominacao?.trim() ?? "",
    dept: c.equipe?.denominacao?.trim() ?? "",
    telefone: (p.telefoneCelular ?? p.telefoneFixo ?? "").trim(),
    email: (p.email ?? "").trim(),
    emailCorporativo: (p.emailCorporativo ?? "").trim(),
    unidadeQuark: unidadeNome,
    desligado: !!c.dataDesligamento || c.ativo === false,
  };
}

// ── Cache do quadro de colaboradores ─────────────────────────────────────────

const TTL_MS = 10 * 60 * 1000; // 10 minutos
let cache: { quando: number; lista: PreAdmissaoQuark[] } | null = null;
let cacheBruto: { quando: number; lista: { unidade: string; reg: ColabQuark }[] } | null = null;
let carregando: Promise<PreAdmissaoQuark[]> | null = null;

interface Unidade {
  id: number;
  nome: string;
}

async function listarUnidades(): Promise<Unidade[]> {
  const r = await api<{ dados: Unidade[] }>("/v1/unidades");
  return r.dados ?? [];
}

/** Todas as páginas de uma unidade (100 por página, 1-based; para quando vier vazia). */
async function colaboradoresDaUnidade(u: Unidade): Promise<{ unidade: string; reg: ColabQuark }[]> {
  const out: { unidade: string; reg: ColabQuark }[] = [];
  for (let page = 1; page <= 50; page++) {
    const r = await api<{ dados: ColabQuark[] }>(`/v1/colaboradores/?page=${page}`, u.id);
    const dados = r.dados ?? [];
    if (!dados.length) break;
    out.push(...dados.map((reg) => ({ unidade: u.nome, reg })));
    if (dados.length < 100) break;
  }
  return out;
}

/** Registros crus de todas as unidades — base do cache e da exportação. */
async function quadroBruto(): Promise<{ unidade: string; reg: ColabQuark }[]> {
  if (cacheBruto && Date.now() - cacheBruto.quando < TTL_MS) return cacheBruto.lista;
  await quadro(); // preenche os dois caches na mesma varredura
  return cacheBruto?.lista ?? [];
}

async function carregarQuadro(): Promise<PreAdmissaoQuark[]> {
  const unidades = await listarUnidades();
  // sequencial de propósito: em paralelo a API responde 429
  const vistos = new Set<number>();
  const lista: PreAdmissaoQuark[] = [];
  const brutos: { unidade: string; reg: ColabQuark }[] = [];
  for (const u of unidades) {
    let daUnidade: { unidade: string; reg: ColabQuark }[] = [];
    try {
      daUnidade = await colaboradoresDaUnidade(u);
    } catch {
      continue; // uma unidade indisponível não derruba a busca inteira
    }
    for (const { unidade, reg } of daUnidade) {
      if (vistos.has(reg.id)) continue; // a mesma pessoa pode estar em duas unidades
      vistos.add(reg.id);
      lista.push(mapear(reg, unidade));
      brutos.push({ unidade, reg });
    }
  }
  cacheBruto = { quando: Date.now(), lista: brutos };
  return lista;
}

async function quadro(forcar = false): Promise<PreAdmissaoQuark[]> {
  if (!forcar && cache && Date.now() - cache.quando < TTL_MS) return cache.lista;
  if (carregando) return carregando; // evita buscas simultâneas duplicadas
  carregando = carregarQuadro()
    .then((lista) => {
      cache = { quando: Date.now(), lista };
      return lista;
    })
    .finally(() => {
      carregando = null;
    });
  return carregando;
}

// ── Busca ────────────────────────────────────────────────────────────────────

export interface ResultadoBusca {
  ok: boolean;
  resultados: PreAdmissaoQuark[];
  erro?: string;
}

const MOCK: PreAdmissaoQuark = {
  quarkId: 0,
  nome: "Bruno Ferraz Almeida",
  cpf: "286.554.910-38",
  admissao: "24/08/2026",
  cargo: "Atendente de loja",
  dept: "Operações",
  telefone: "(11) 90000-0000",
  email: "",
  emailCorporativo: "",
  unidadeQuark: "MOCK",
  desligado: false,
};

/**
 * Busca por CPF (com ou sem pontuação) ou por parte do nome.
 * Retorna todos os candidatos — quem escolhe é a tela.
 */
export async function buscarPreAdmissao(termo: string): Promise<ResultadoBusca> {
  const t = (termo ?? "").trim();
  if (!configurado()) {
    await new Promise((r) => setTimeout(r, 800)); // MOCK
    return { ok: true, resultados: [{ ...MOCK, cpf: t || MOCK.cpf }] };
  }
  if (t.length < 3) return { ok: false, resultados: [], erro: "Digite ao menos 3 caracteres do CPF ou do nome" };

  try {
    const lista = await quadro();
    const digitos = soDigitos(t);
    let achados: PreAdmissaoQuark[];

    if (digitos.length >= 3 && digitos.length >= t.replace(/\s/g, "").length - 3) {
      // parece CPF/matrícula: casa por dígitos do CPF ou pelo id do Quark
      achados = lista.filter(
        (c) => soDigitos(c.cpf).includes(digitos) || String(c.quarkId) === digitos
      );
    } else {
      const alvo = t.toLowerCase();
      achados = lista.filter((c) => c.nome.toLowerCase().includes(alvo));
    }

    // ativos primeiro, depois admissão mais recente
    achados.sort(
      (a, b) =>
        Number(a.desligado) - Number(b.desligado) || b.admissao.slice(6).localeCompare(a.admissao.slice(6))
    );
    return { ok: true, resultados: achados.slice(0, 25) };
  } catch (e) {
    return { ok: false, resultados: [], erro: (e as Error).message };
  }
}

// ── Exportação: o cadastro INTEIRO, não só os campos que o app usa ───────────

const ROTULOS: Record<string, string> = {
  cpfCnpj: "CPF", pis: "PIS", rg: "RG", nome: "Nome", email: "E-mail pessoal",
  emailCorporativo: "E-mail corporativo", telefoneCelular: "Celular", telefoneFixo: "Telefone fixo",
  dataNascimento: "Data de nascimento", nomeMae: "Nome da mãe", nomePai: "Nome do pai",
};

function rotulo(caminho: string): string {
  const folha = caminho.split(".").pop()!;
  if (ROTULOS[folha]) return ROTULOS[folha];
  // camelCase → "Camel case"
  const t = folha.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function valorTexto(chave: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  if (typeof v === "number") {
    // epoch em ms nos campos de data
    if (/^data/i.test(chave) && v > 1e11) return dataBRdeEpoch(v);
    return String(v);
  }
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    const nome = o.denominacao ?? o.nome ?? o.descricao;
    return nome ? String(nome) : "";
  }
  return String(v);
}

/**
 * Tabela de domínio (cargo, situação, equipe) vira UMA coluna com a
 * denominação. Registro de verdade (pessoa, endereço) é aberto campo a campo —
 * senão o cadastro inteiro colapsaria numa coluna só.
 */
function ehDominio(o: Record<string, unknown>): boolean {
  if (o.denominacao !== undefined || o.descricao !== undefined) return true;
  const uteis = Object.keys(o).filter((k) => k !== "id" && k !== "version");
  return uteis.length <= 2 && o.nome !== undefined;
}

/** Achata o registro (pessoa, cargo, situação…) em pares chave→texto. */
function achatar(o: unknown, prefixo = "", nivel = 0): Record<string, string> {
  const out: Record<string, string> = {};
  if (!o || typeof o !== "object" || nivel > 3) return out;
  for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
    if (k === "id" || k === "version" || Array.isArray(v)) continue;
    const caminho = prefixo ? `${prefixo}.${k}` : k;
    if (v && typeof v === "object" && !ehDominio(v as Record<string, unknown>)) {
      Object.assign(out, achatar(v, caminho, nivel + 1));
    } else {
      out[caminho] = valorTexto(k, v);
    }
  }
  return out;
}

export interface ExportacaoQuark {
  cabecalho: string[];
  linhas: string[][];
}

/**
 * Cadastro completo de todo mundo no Quark — todos os campos do formulário de
 * admissão, não só os que o LOCCONTROL usa. As colunas são descobertas dos
 * próprios dados, então campos novos do Quark aparecem sozinhos.
 */
export async function exportacaoCompleta(): Promise<ExportacaoQuark | null> {
  if (!configurado()) return null;
  let brutos: { unidade: string; reg: ColabQuark }[];
  try {
    brutos = await quadroBruto();
  } catch {
    return null;
  }
  if (!brutos.length) return null;

  const achatados: Record<string, string>[] = brutos.map((b) => ({
    Unidade: b.unidade,
    ...achatar(b.reg),
  }));

  // união de todas as chaves, preservando a ordem de aparição
  const chaves: string[] = [];
  for (const a of achatados) for (const k of Object.keys(a)) if (!chaves.includes(k)) chaves.push(k);

  return {
    cabecalho: chaves.map((k) => (k === "Unidade" ? k : rotulo(k))),
    linhas: achatados.map((a) => chaves.map((k) => a[k] ?? "")),
  };
}

/** Quadro completo (ativos e desligados) para a exportação. [] se não configurado. */
export async function quadroCompleto(): Promise<PreAdmissaoQuark[]> {
  if (!configurado()) return [];
  try {
    return await quadro();
  } catch {
    return []; // Quark fora do ar não derruba a exportação das outras bases
  }
}

/** Recarrega o cache do quadro (usado pelo botão de teste em Configurações). */
export async function testarConexao(): Promise<{ ok: boolean; total?: number; erro?: string }> {
  if (!configurado()) return { ok: false, erro: "QUARKRH_TOKEN não configurado no .env" };
  try {
    const lista = await quadro(true);
    return { ok: true, total: lista.length };
  } catch (e) {
    return { ok: false, erro: (e as Error).message };
  }
}
