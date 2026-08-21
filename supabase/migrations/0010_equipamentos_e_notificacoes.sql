-- 1) Catálogo de equipamentos editável (Configurações → Editar template).
--    "kit" marca o que vem pré-selecionado no passo 2 da pré-admissão.
create table equipamentos_catalogo (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  kit boolean not null default false,
  ordem int not null default 0
);

alter table equipamentos_catalogo enable row level security;
create policy sel_eq_cat on equipamentos_catalogo for select using (papel_atual() <> '');
create policy mut_eq_cat on equipamentos_catalogo for all
  using (eh_admin()) with check (eh_admin());

insert into equipamentos_catalogo (nome, kit, ordem) values
  ('Celular', false, 1),
  ('Chip corporativo', false, 2),
  ('Fone', true, 3),
  ('Monitor', true, 4),
  ('Mouse', true, 5),
  ('Mousepad', true, 6),
  ('Notebook', true, 7),
  ('Teclado', true, 8),
  ('Webcam', false, 9);

-- 2) Notificações do sistema (entregues no navegador e/ou por e-mail,
--    conforme as preferências de cada usuário em Configurações).
create table notificacoes (
  id bigint generated always as identity primary key,
  criado_em timestamptz not null default now(),
  tipo text not null check (tipo in ('pre','chamado','sla','login','grupos')),
  alvo text not null check (alvo in ('rh','ti','admins','todos')),
  titulo text not null,
  corpo text not null,
  ref text  -- deduplicação (ex.: 'CH-4832:sla24')
);

create unique index notificacoes_ref_idx on notificacoes(tipo, ref) where ref is not null;
create index notificacoes_id_idx on notificacoes(id desc);

alter table notificacoes enable row level security;
create policy sel_notif on notificacoes for select using (papel_atual() <> '');
create policy ins_notif on notificacoes for insert with check (papel_atual() <> '');
