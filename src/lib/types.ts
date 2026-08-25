export type Papel = "Superadmin" | "Admin RH" | "Admin T.I" | "Usuário T.I" | "Usuário RH";
export type StatusColab = "Pré-admissão" | "Ativo" | "Afastado" | "Desligado";

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
  status: "aprovado" | "pendente";
  superadmin: boolean;
  ultimo_acesso: string | null;
  solicitado_em: string | null;
  notif: Record<string, boolean>;
  /** Unidades permitidas no formato "Cidade|Unidade". Vazio = todas. */
  unidades_acesso: string[];
}

/**
 * Contas importadas do Google Workspace chegam só com nome, e-mail e situação —
 * por isso quase tudo é opcional até um admin preencher (ver 0008).
 */
export interface Colaborador {
  id: string;
  nome: string;
  cpf: string | null;
  cargo: string | null;
  dept: string | null;
  admissao: string | null; // ISO date
  status: StatusColab | null; // null = a definir
  email: string | null;
  /** E-mail particular (vindo do Quark) — só para entregar as credenciais. */
  email_pessoal: string | null;
  telefone: string | null;
  cidade: string | null;
  unidade: string | null;
  grupos: string[];
  equipamentos: string[];
  /** Acessos aprovados pelo RH. null = pré-admissão antiga → usar a matriz do cargo. */
  acessos: string[] | null;
  analista: string | null;
  obs_ti: string | null;
  desligamento: string | null;
  bloqueado: { quando: string; por: string; motivo: string } | null;
  sync_falha: string | null;
  origem: "manual" | "quarkrh" | "workspace";
  google_id: string | null;
  suspenso: boolean;
  ultimo_login: string | null;
}

export interface Documento {
  id: string;
  colaborador_id: string;
  arquivo: string;
  assinado_em: string | null;
}

export interface Evento {
  id: string;
  colaborador_id: string;
  fase: "pre" | "ativo" | "afastado" | "desligado";
  quando: string;
  ator: string;
  descricao: string;
}

export interface Chamado {
  id: string;
  colaborador_id: string | null;
  tipo: string;
  silenciado: boolean;
  sla_alvo: string | null;
  payload:
    | { acao: "add-cidade" | "del-cidade" | "add-unid" | "del-unid"; cidade: string; unidade?: string }
    | { gTipo: "criacao" | "exclusao"; nome: string; email: string }
    | null;
  analista: string | null;
  solicitante: string | null;
  /** true = parte da TI concluída na ferramenta de chamados: sai da fila da TI, fica na do RH. */
  ti_concluido: boolean;
  /** Preenchido = arquivado (histórico). As filas só mostram concluido_em nulo. */
  concluido_em: string | null;
  resultado: "concluido" | "cancelado" | "negado" | null;
  concluido_por: string | null;
  criado_em: string;
}

export interface ChecklistItem {
  id: string;
  colaborador_id: string;
  lista: "rh" | "ti";
  ordem: number;
  titulo: string;
  done: boolean;
  por: string | null;
  quando: string | null;
  obs: string | null;
}

export interface GrupoWorkspace {
  id: string;
  nome: string;
  email: string;
}

export interface MembroExterno {
  id: string;
  grupo_email: string;
  nome: string;
  email: string;
}

export interface Auditoria {
  id: number;
  pessoa: string;
  ator: string;
  quando: string;
  tabela: string;
  campo: string;
  antes: string;
  depois: string;
}

export interface MatrizCel {
  cargo: string;
  acesso: string;
  ligado: boolean;
  obrigatorio: boolean;
}

export type UnidadesMap = Record<string, string[]>;

export interface FatiaStatus {
  st: string;
  n: number;
  cor: string;
}

/** Template do checklist de offboarding (Configurações → Templates) */
export const CHECKLIST_TEMPLATE = {
  rh: [
    "Calcular e registrar rescisão",
    "Agendar exame demissional",
    "Comunicar equipe e gestor",
    "Arquivar documentos assinados",
  ],
  ti: [
    "Dar baixa nos equipamentos listados no termo",
    "Recolher notebook",
    "Recolher celular corporativo",
    "Remover dos grupos de e-mail",
    "Desativar acessos (VPN, ERP, BI)",
    "Arquivar caixa de e-mail",
  ],
};

export const EQUIPAMENTOS = [
  "Celular", "Chip corporativo", "Fone", "Monitor", "Mouse",
  "Mousepad", "Notebook", "Teclado", "Webcam",
];

export const KIT_PADRAO = ["Fone", "Monitor", "Mouse", "Mousepad", "Notebook", "Teclado"];

export const UNIT_GRUPOS: Record<string, string> = {
  "Belo Horizonte": "bh@locgrupo.com.br",
  "Belém": "belem@locgrupo.com.br",
  "Rio de Janeiro": "rj@locgrupo.com.br",
  "São Paulo": "sp@locgrupo.com.br",
};
