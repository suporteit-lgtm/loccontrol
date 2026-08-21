-- Função RPC para obter o próximo número de chamado (CH-NNNN)
create or replace function proximo_chamado() returns bigint
language sql
security definer
as $$
  select nextval('chamado_seq')
$$;
