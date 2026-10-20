-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  Agendamento de Salas                                                    ║
-- ║                                                                          ║
-- ║  Salas de reunião reservadas por horário. Mesmo acesso da Escala (login   ║
-- ║  Google @locgrupo.com.br em /salas) e também pelo LocControl.             ║
-- ║  • Duas reservas ATIVAS da mesma sala nunca se sobrepõem: a restrição     ║
-- ║    EXCLUDE garante isso no banco, mesmo com cliques simultâneos.          ║
-- ║  • O servidor usa service_role; anon e authenticated não acessam nada.    ║
-- ║  Nenhuma tabela existente é alterada.                                    ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

create extension if not exists btree_gist;

-- ── Salas ────────────────────────────────────────────────────────────────────
create table if not exists sala (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null check (length(trim(nome)) between 1 and 60),
  descricao   text,                                  -- ex.: "Foco para call", "Reunião"
  capacidade  int  not null default 1 check (capacidade between 1 and 200),
  local       text,                                  -- ex.: "BH · Centro · 2º andar"
  recursos    text[] not null default '{}',          -- ex.: {TV, Videoconferência}
  ativo       boolean not null default true,
  ordem       int not null default 0,
  criado_em   timestamptz not null default now()
);

-- ── Regras (linha única) ─────────────────────────────────────────────────────
create table if not exists sala_config (
  id                boolean primary key default true check (id),
  hora_inicio       time not null default '08:00',
  hora_fim          time not null default '19:00',
  intervalo_min     int  not null default 30 check (intervalo_min in (15, 30, 60)),
  dias_antecedencia int  not null default 30 check (dias_antecedencia between 1 and 365),
  duracao_max_min   int  not null default 240 check (duracao_max_min between 15 and 720),
  fim_de_semana     boolean not null default false,
  check (hora_fim > hora_inicio)
);
insert into sala_config default values on conflict do nothing;

-- ── Reservas ─────────────────────────────────────────────────────────────────
create table if not exists sala_reserva (
  id            uuid primary key default gen_random_uuid(),
  sala_id       uuid not null references sala(id) on delete restrict,
  inicio        timestamptz not null,
  fim           timestamptz not null,
  titulo        text check (titulo is null or length(titulo) <= 120),
  email         text not null,                      -- dono da reserva (minúsculo)
  nome          text not null,
  criado_por    text not null,                      -- e-mail de quem criou (a pessoa ou um admin)
  status        text not null default 'ATIVA' check (status in ('ATIVA', 'CANCELADA')),
  cancelada_em  timestamptz,
  cancelada_por text,
  criado_em     timestamptz not null default now(),
  check (fim > inicio),
  constraint sala_reserva_sem_conflito
    exclude using gist (sala_id with =, tstzrange(inicio, fim) with &&) where (status = 'ATIVA')
);
create index if not exists sala_reserva_email_idx  on sala_reserva (email, inicio);
create index if not exists sala_reserva_inicio_idx on sala_reserva (inicio);

-- ── Acesso: só o servidor (service_role) ─────────────────────────────────────
alter table sala         enable row level security;
alter table sala_config  enable row level security;
alter table sala_reserva enable row level security;
revoke all on sala, sala_config, sala_reserva from anon, authenticated;
