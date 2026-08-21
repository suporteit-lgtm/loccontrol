-- Colaboradores vindos do Google Workspace + campos preenchidos pelo admin.
--
-- O Workspace só conhece nome, e-mail e situação da conta. Cargo, CPF, unidade,
-- admissão e status ficam VAZIOS até um admin preencher — por isso as colunas
-- deixam de ser obrigatórias e o status passa a aceitar nulo.

-- 1) Campos que o Workspace não fornece deixam de ser obrigatórios
alter table colaboradores alter column cpf drop not null;
alter table colaboradores alter column cargo drop not null;
alter table colaboradores alter column cidade drop not null;
alter table colaboradores alter column unidade drop not null;

-- 2) Status aceita nulo (= "a definir"); os valores válidos continuam os mesmos
alter table colaboradores alter column status drop not null;
alter table colaboradores alter column status drop default;
alter table colaboradores drop constraint if exists colaboradores_status_check;
alter table colaboradores add constraint colaboradores_status_check
  check (status is null or status in ('Pré-admissão','Ativo','Afastado','Desligado'));

-- 3) Procedência e dados espelhados do Workspace
alter table colaboradores
  add column if not exists origem text not null default 'manual'
    check (origem in ('manual','quarkrh','workspace')),
  add column if not exists google_id text,
  add column if not exists suspenso boolean not null default false,
  add column if not exists ultimo_login timestamptz,
  add column if not exists sincronizado_em timestamptz;

create unique index if not exists colaboradores_google_id_idx
  on colaboradores(google_id) where google_id is not null;

-- e-mail único (case-insensitive) — chave do espelho com o Workspace
create unique index if not exists colaboradores_email_idx
  on colaboradores(lower(email)) where email is not null;

-- 4) Estado das sincronizações (para respeitar os intervalos entre chamadas)
create table if not exists sync_estado (
  chave text primary key,
  quando timestamptz not null default now(),
  detalhe text
);

grant all privileges on table sync_estado to service_role;
grant select, insert, update, delete on table sync_estado to authenticated;
alter table sync_estado enable row level security;
create policy sel_sync on sync_estado for select using (papel_atual() <> '');
create policy mut_sync on sync_estado for all
  using (papel_atual() <> '') with check (papel_atual() <> '');
