-- LOCCONTROL — Schema inicial
-- Sistema de ciclo de vida de colaboradores (RH + TI) do Grupo LOC

create extension if not exists pgcrypto;

-- ── Cidades e unidades ────────────────────────────────────────────────────────
create table cidades (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  criado_em timestamptz not null default now()
);

create table unidades (
  id uuid primary key default gen_random_uuid(),
  cidade_id uuid not null references cidades(id) on delete cascade,
  nome text not null,
  criado_em timestamptz not null default now(),
  unique (cidade_id, nome)
);

-- ── Cargos, acessos e matriz ──────────────────────────────────────────────────
create table cargos (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique
);

create table acessos (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  ordem int not null default 0
);

create table matriz (
  cargo_id uuid not null references cargos(id) on delete cascade,
  acesso_id uuid not null references acessos(id) on delete cascade,
  ligado boolean not null default false,
  obrigatorio boolean not null default false,
  primary key (cargo_id, acesso_id)
);

-- ── Usuários do sistema ───────────────────────────────────────────────────────
create table usuarios (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text not null unique,
  papel text not null check (papel in ('Superadmin','Admin RH','Admin T.I','Usuário T.I','Usuário RH')),
  status text not null default 'pendente' check (status in ('aprovado','pendente')),
  superadmin boolean not null default false,
  ultimo_acesso timestamptz,
  solicitado_em timestamptz,
  notif jsonb not null default '{"email":true,"sistema":true,"pre":true,"chamado":true,"sla":true,"login":false,"grupos":false}'::jsonb,
  criado_em timestamptz not null default now()
);

-- ── Colaboradores ─────────────────────────────────────────────────────────────
create table colaboradores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cpf text not null,
  cargo text not null,
  dept text,
  admissao date,
  status text not null default 'Pré-admissão'
    check (status in ('Pré-admissão','Ativo','Afastado','Desligado')),
  email text,                    -- null enquanto pré-admissão (exibido como "—")
  telefone text,
  cidade text not null,
  unidade text not null,
  grupos text[] not null default '{}',        -- e-mails dos grupos do Workspace
  equipamentos text[] not null default '{}',
  analista text,
  obs_ti text,
  desligamento date,
  bloqueado jsonb,               -- { "quando": "...", "por": "...", "motivo": "..." }
  sync_falha text,               -- e-mail de grupo cuja aplicação falhou (mock da integração)
  criado_em timestamptz not null default now()
);

create index colaboradores_status_idx on colaboradores(status);
create index colaboradores_unidade_idx on colaboradores(cidade, unidade);
create index colaboradores_grupos_idx on colaboradores using gin(grupos);

-- ── Documentos do colaborador ─────────────────────────────────────────────────
create table documentos (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references colaboradores(id) on delete cascade,
  arquivo text not null,
  assinado_em date,
  criado_em timestamptz not null default now()
);

-- ── Eventos por fase (trilha do perfil) ───────────────────────────────────────
create table eventos (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references colaboradores(id) on delete cascade,
  fase text not null check (fase in ('pre','ativo','afastado','desligado')),
  quando timestamptz not null default now(),
  ator text not null,
  descricao text not null
);

create index eventos_colab_idx on eventos(colaborador_id, fase, quando);

-- ── Chamados (fila da TI) ─────────────────────────────────────────────────────
-- Também guarda solicitações de aprovação (cidade/unidade/grupo) via payload.
create sequence chamado_seq start 4841;

create table chamados (
  id text primary key,                        -- CH-4821
  colaborador_id uuid references colaboradores(id) on delete cascade,
  tipo text not null,                         -- Admissão | Desligamento | Criação de grupo | ...
  silenciado boolean not null default false,  -- coluna "pré-concluído" (alertas silenciados)
  sla_alvo timestamptz,                       -- coluna do kanban é derivada disto
  payload jsonb,                              -- solicitações: {acao,cidade,unidade} | {gTipo,nome,email}
  analista text,
  solicitante text,
  criado_em timestamptz not null default now()
);

create index chamados_colab_idx on chamados(colaborador_id);

-- ── Checklist de offboarding ──────────────────────────────────────────────────
create table checklist_itens (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references colaboradores(id) on delete cascade,
  lista text not null check (lista in ('rh','ti')),
  ordem int not null default 0,
  titulo text not null,
  done boolean not null default false,
  por text,
  quando timestamptz,
  obs text
);

create index checklist_colab_idx on checklist_itens(colaborador_id, lista, ordem);

-- ── Grupos do Workspace (espelho — integração real pendente) ──────────────────
create table grupos_workspace (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text not null unique,
  criado_em timestamptz not null default now()
);

-- Membros que não são colaboradores cadastrados (vieram "do Workspace")
create table grupo_membros_externos (
  id uuid primary key default gen_random_uuid(),
  grupo_email text not null,
  nome text not null,
  email text not null,
  unique (grupo_email, email)
);

-- ── Auditoria (trilha imutável) ───────────────────────────────────────────────
create table auditoria (
  id bigint generated always as identity primary key,
  pessoa text not null default '—',
  ator text not null,
  quando timestamptz not null default now(),
  tabela text not null,
  campo text not null,
  antes text not null default '—',
  depois text not null default '—'
);

create index auditoria_quando_idx on auditoria(quando desc);
create index auditoria_pessoa_idx on auditoria(pessoa);

-- Imutável: proíbe update/delete mesmo para o dono da tabela
create or replace function auditoria_imutavel() returns trigger
language plpgsql as $$
begin
  raise exception 'O log de auditoria é imutável';
end $$;

create trigger auditoria_sem_update before update or delete on auditoria
  for each row execute function auditoria_imutavel();

-- ── Rascunho do wizard de pré-admissão (persiste entre telas) ─────────────────
create table wizard_drafts (
  usuario_id uuid primary key references usuarios(id) on delete cascade,
  dados jsonb not null,
  atualizado_em timestamptz not null default now()
);
