-- Privilégios para os papéis da API do Supabase (PostgREST).
-- Necessário porque as tabelas foram criadas via conexão direta (migrations),
-- fora do fluxo do dashboard que aplica esses grants automaticamente.

grant usage on schema public to anon, authenticated, service_role;

-- service_role: acesso total (o app server-side usa esta chave; ignora RLS)
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- authenticated: leitura/escrita SEMPRE filtrada pelas políticas de RLS (0002)
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

-- anon: nada além do que o RLS liberar (nenhuma política libera — sem acesso)

-- Objetos futuros criados pelas próximas migrations herdam os mesmos grants
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant usage on sequences to authenticated;
alter default privileges in schema public grant execute on functions to authenticated;
