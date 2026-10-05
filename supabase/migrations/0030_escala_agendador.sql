-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  Escala de Presença — agendador das automações (pg_cron + pg_net)         ║
-- ║                                                                          ║
-- ║  Plano gratuito da Vercel: sem Vercel Cron de 10 em 10 min. O próprio     ║
-- ║  Postgres do Supabase chama POST /api/escala/cron/ciclo a cada 10 min;    ║
-- ║  o "ciclo" decide o que está na hora pelos horários das Configurações     ║
-- ║  da Escala (lembrete, resumo, 01:00, 23:00, 1º/dez, Google a cada 30 min).║
-- ║                                                                          ║
-- ║  Nenhuma credencial neste arquivo: a URL e o CRON_SECRET ficam no Vault   ║
-- ║  do Supabase e são lidos na hora da chamada. Sem os dois segredos o job   ║
-- ║  não faz nada. Para configurar (SQL Editor, uma vez):                     ║
-- ║    select vault.create_secret('https://<domínio>/api/escala/cron/ciclo',  ║
-- ║                               'escala_cron_url');                         ║
-- ║    select vault.create_secret('<mesmo CRON_SECRET da Vercel>',            ║
-- ║                               'escala_cron_secret');                      ║
-- ║  Nenhuma tabela do LocControl é alterada; nenhuma política RLS muda.      ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Função que faz a chamada (security definer: lê o Vault; ninguém de fora executa)
create or replace function escala_disparar_ciclo() returns bigint
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_url text;
  v_segredo text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'escala_cron_url';
  select decrypted_secret into v_segredo from vault.decrypted_secrets where name = 'escala_cron_secret';
  if v_url is null or v_segredo is null then
    return null;                                              -- ainda não configurado: não faz nada
  end if;
  return net.http_post(
    url := v_url,
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_segredo, 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end $$;

revoke execute on function escala_disparar_ciclo() from public, anon, authenticated;

-- a cada 10 minutos (idempotente: reaplicar a migration só reagenda o mesmo job)
select cron.unschedule(jobid) from cron.job where jobname = 'escala-ciclo';
select cron.schedule('escala-ciclo', '*/10 * * * *', $$select escala_disparar_ciclo()$$);
