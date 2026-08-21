-- Controle de acesso por unidade.
-- Cada usuário pode ter acesso a uma ou mais unidades; lista vazia = todas.
-- Formato de cada item: 'Cidade|Unidade' (ex.: 'Rio de Janeiro|Niterói').

alter table usuarios
  add column unidades_acesso text[] not null default '{}';

comment on column usuarios.unidades_acesso is
  'Unidades que o usuário pode ver, no formato Cidade|Unidade. Vazio = todas. Superadmin ignora.';
