-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  Escala de Presença — tabelas (migration ADITIVA)                         ║
-- ║  Nada existente é alterado, exceto um trigger novo em colaboradores que   ║
-- ║  só INSERE um evento quando o status de um participante muda.            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ── Configuração global (1 linha): modos de envio e allowlist ────────────────
create table escala_global (
  id boolean primary key default true check (id),            -- garante linha única
  modo_envio text not null default 'DESLIGADO' check (modo_envio in ('DESLIGADO','TESTE','PRODUCAO')),
  modo_google text not null default 'DESLIGADO' check (modo_google in ('DESLIGADO','TESTE','PRODUCAO')),
  allowlist text[] not null default '{ksnkaique@gmail.com,kaique.santos@locgrupo.com.br}',
  calendario_teste_id text,                                   -- agenda usada no modo TESTE
  atualizado_em timestamptz not null default now(),
  atualizado_por text
);
insert into escala_global (id) values (true);

-- ── Configuração por unidade (parâmetros da seção 2) ─────────────────────────
create table escala_config (
  unidade_id uuid primary key references unidades(id) on delete cascade,
  habilitado boolean not null default false,                  -- feature flag por unidade
  capacidade int not null default 22 check (capacidade > 0),
  data_ancora date,                                           -- definida pelo admin na liberação
  grupo_inicial char(1) not null default 'A' check (grupo_inicial in ('A','B')),
  limite_mensal int not null default 4 check (limite_mensal >= 0),
  prazo_hora time not null default '18:00',                   -- do dia útil anterior
  oferta_validade_min int not null default 120 check (oferta_validade_min > 0),
  lembrete_hora time not null default '17:00',
  resumo_dia_semana int not null default 1 check (resumo_dia_semana between 0 and 6), -- 1 = segunda
  resumo_hora time not null default '08:00',
  calendario_id text,                                         -- agenda "Escala de Presença — BH" (produção)
  atualizado_em timestamptz not null default now()
);

-- ── Grupos A/B por unidade ───────────────────────────────────────────────────
create table escala_grupo (
  id uuid primary key default gen_random_uuid(),
  unidade_id uuid not null references unidades(id) on delete cascade,
  letra char(1) not null check (letra in ('A','B')),
  email_workspace text,                                       -- escala-bh-a@locgrupo.com.br
  email_teste text,                                           -- escala-teste-a@locgrupo.com.br
  unique (unidade_id, letra)
);

-- ── Participantes (colaboradores já existentes) ─────────────────────────────
create table escala_participante (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null unique references colaboradores(id) on delete cascade,
  grupo_id uuid not null references escala_grupo(id),
  ativo boolean not null default true,
  auth_user_id uuid unique,                                   -- vínculo com o login Google (auth.users)
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index escala_participante_grupo_idx on escala_participante(grupo_id) where ativo;

-- Histórico de afastamentos (só datas — o motivo NUNCA é armazenado, LGPD)
create table escala_afastamento (
  id uuid primary key default gen_random_uuid(),
  participante_id uuid not null references escala_participante(id) on delete cascade,
  inicio date not null,
  fim date,                                                   -- null = afastado até hoje
  check (fim is null or fim >= inicio)
);
create index escala_afastamento_part_idx on escala_afastamento(participante_id, inicio);

-- ── Feriados ─────────────────────────────────────────────────────────────────
create table escala_feriado (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  nome text not null,
  unidade_id uuid references unidades(id) on delete cascade,  -- null = nacional (vale para todas)
  origem text not null check (origem in ('NACIONAL_API','MANUAL')),
  sem_expediente boolean not null default false,              -- "dia sem expediente" (não é feriado oficial)
  criado_em timestamptz not null default now(),
  criado_por text
);
-- uma data por escopo (nacional ou unidade); a importação usa isso para ser idempotente
create unique index escala_feriado_uniq on escala_feriado(data, coalesce(unidade_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- ── Escala materializada ─────────────────────────────────────────────────────
create table escala_dia (
  unidade_id uuid not null references unidades(id) on delete cascade,
  data date not null,
  grupo char(1) not null check (grupo in ('A','B')),
  prazo timestamptz not null,                                 -- prazo de cancelamento/ausência deste dia
  congelado boolean not null default false,                   -- dias passados nunca mudam
  escalados uuid[],                                           -- foto de quem era do grupo ao congelar (histórico)
  google_event_id text,
  google_event_teste_id text,
  sync_hash text,                                             -- evita reenviar evento igual
  sincronizado_em timestamptz,
  primary key (unidade_id, data)
);

-- ── Ausências avisadas ("Não vou neste dia") ─────────────────────────────────
create table escala_ausencia (
  id uuid primary key default gen_random_uuid(),
  participante_id uuid not null references escala_participante(id) on delete cascade,
  unidade_id uuid not null references unidades(id) on delete cascade,
  data date not null,
  em_cima_da_hora boolean not null default false,
  registrado_por text not null,                               -- 'proprio' ou nome do RH
  criado_em timestamptz not null default now(),
  unique (participante_id, data)
);
create index escala_ausencia_dia_idx on escala_ausencia(unidade_id, data);

-- ── Reservas ─────────────────────────────────────────────────────────────────
create table escala_reserva (
  id uuid primary key default gen_random_uuid(),
  participante_id uuid not null references escala_participante(id) on delete cascade,
  unidade_id uuid not null references unidades(id) on delete cascade,
  data date not null,
  status text not null default 'CONFIRMADA'
    check (status in ('CONFIRMADA','CANCELADA','UTILIZADA','EXPIRADA')),
  origem text not null default 'DIRETA' check (origem in ('DIRETA','FILA')),
  motivo_cancelamento text,                                   -- 'pessoa' | 'admin' | 'feriado' | 'grupo' | 'desligado' | 'afastado'
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
-- sem reserva duplicada da mesma pessoa no mesmo dia (canceladas/expiradas não contam)
create unique index escala_reserva_ativa_uniq on escala_reserva(participante_id, data)
  where status in ('CONFIRMADA','UTILIZADA');
create index escala_reserva_dia_idx on escala_reserva(unidade_id, data, status);

-- ── Lista de espera (FIFO pela hora de entrada) ──────────────────────────────
create table escala_fila (
  id uuid primary key default gen_random_uuid(),
  participante_id uuid not null references escala_participante(id) on delete cascade,
  unidade_id uuid not null references unidades(id) on delete cascade,
  data date not null,
  entrou_em timestamptz not null default clock_timestamp(),
  status text not null default 'AGUARDANDO'
    check (status in ('AGUARDANDO','OFERECIDA','ATENDIDA','EXPIRADA','CANCELADA')),
  oferta_expira_em timestamptz,
  oferta_token_hash text,                                     -- link "aceitar" do e-mail (sha256)
  atualizado_em timestamptz not null default now()
);
create unique index escala_fila_ativa_uniq on escala_fila(participante_id, data)
  where status in ('AGUARDANDO','OFERECIDA');
create index escala_fila_dia_idx on escala_fila(unidade_id, data, status, entrou_em);
create index escala_fila_oferta_idx on escala_fila(oferta_expira_em) where status = 'OFERECIDA';

-- ── Preferências do colaborador ──────────────────────────────────────────────
create table escala_preferencia (
  participante_id uuid primary key references escala_participante(id) on delete cascade,
  lembretes boolean not null default true,
  ics_token_hash text unique,                                 -- feed ICS (token só é mostrado uma vez)
  ics_criado_em timestamptz
);

-- ── E-mails (idempotência + registro do modo de envio) ──────────────────────
create table escala_email_enviado (
  chave text primary key,                                     -- ex.: 'lembrete:<participante>:<data>'
  destinatario text not null,
  tipo text not null,
  assunto text,
  status text not null check (status in ('ENVIADO','BLOQUEADO_MODO','ERRO')),
  modo text not null,
  erro text,
  criado_em timestamptz not null default now()
);
create index escala_email_quando_idx on escala_email_enviado(criado_em desc);

-- ── Log das automações ───────────────────────────────────────────────────────
create table escala_log_job (
  id bigint generated always as identity primary key,
  tarefa text not null,
  inicio timestamptz not null default now(),
  fim timestamptz,
  status text not null default 'RODANDO' check (status in ('RODANDO','OK','ERRO','IGNORADO')),
  itens int not null default 0,
  erro text,
  disparado_por text not null default 'cron'                  -- 'cron' | nome do admin ("Rodar agora")
);
create index escala_log_job_idx on escala_log_job(tarefa, inicio desc);

-- ── Eventos internos (processados na hora pelo servidor) ─────────────────────
create table escala_evento (
  id bigint generated always as identity primary key,
  tipo text not null,                                         -- STATUS_COLABORADOR | FERIADO | GRUPO | VAGA ...
  payload jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  processado_em timestamptz,
  erro text
);
create index escala_evento_pendente_idx on escala_evento(id) where processado_em is null;

-- ── Trigger: mudança de status de um participante vira evento ───────────────
create or replace function escala_on_status_colaborador() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status
     and exists (select 1 from escala_participante p where p.colaborador_id = new.id) then
    insert into escala_evento (tipo, payload)
    values ('STATUS_COLABORADOR', jsonb_build_object('colaborador_id', new.id, 'de', old.status, 'para', new.status));
  end if;
  return new;
end $$;

create trigger escala_status_colaborador
  after update of status on colaboradores
  for each row execute function escala_on_status_colaborador();

-- ── Configuração inicial: Belo Horizonte · Centro (DESLIGADA) ───────────────
insert into escala_config (unidade_id)
select u.id from unidades u join cidades c on c.id = u.cidade_id
where c.nome = 'Belo Horizonte' and u.nome = 'Centro';

insert into escala_grupo (unidade_id, letra, email_workspace, email_teste)
select cfg.unidade_id, g.letra, g.prod, g.teste
from escala_config cfg
cross join (values
  ('A', 'escala-bh-a@locgrupo.com.br', 'escala-teste-a@locgrupo.com.br'),
  ('B', 'escala-bh-b@locgrupo.com.br', 'escala-teste-b@locgrupo.com.br')
) as g(letra, prod, teste);
