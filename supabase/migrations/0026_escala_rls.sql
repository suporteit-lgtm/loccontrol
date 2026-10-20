-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  Escala de Presença — RLS e privilégios                                   ║
-- ║                                                                          ║
-- ║  O servidor usa service_role (ignora RLS). Estas regras valem para quem   ║
-- ║  usa a anon key exposta no navegador:                                     ║
-- ║   • anon: nada.                                                           ║
-- ║   • authenticated (login Google): só LÊ as próprias linhas e o calendário  ║
-- ║     da própria unidade. Nenhuma escrita direta — reservar, fila e         ║
-- ║     ausência passam pelo servidor, que chama as funções de 0025.          ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ── Liga RLS em todas as tabelas do módulo ───────────────────────────────────
alter table escala_global        enable row level security;
alter table escala_config        enable row level security;
alter table escala_grupo         enable row level security;
alter table escala_participante  enable row level security;
alter table escala_afastamento   enable row level security;
alter table escala_feriado       enable row level security;
alter table escala_dia           enable row level security;
alter table escala_ausencia      enable row level security;
alter table escala_reserva       enable row level security;
alter table escala_fila          enable row level security;
alter table escala_preferencia   enable row level security;
alter table escala_email_enviado enable row level security;
alter table escala_log_job       enable row level security;
alter table escala_evento        enable row level security;

-- ── Zera privilégios herdados dos "default privileges" (0005) ────────────────
revoke all on escala_global, escala_config, escala_grupo, escala_participante, escala_afastamento,
  escala_feriado, escala_dia, escala_ausencia, escala_reserva, escala_fila, escala_preferencia,
  escala_email_enviado, escala_log_job, escala_evento, escala_v_presenca, escala_v_dia
  from anon, authenticated;
revoke all on sequence escala_log_job_id_seq, escala_evento_id_seq from anon, authenticated;

-- Funções de regra: só o servidor (service_role) executa
revoke execute on function
  escala_hoje(timestamptz), escala__lock(uuid, date), escala_afastado(uuid, date),
  escala_ocupacao(uuid, date, timestamptz), escala_posicao_fila(uuid),
  escala__motivo(uuid, date, timestamptz, boolean), escala__processar(uuid, date, timestamptz),
  escala_processar_vaga(uuid, date, timestamptz), escala__unidade(uuid),
  escala_reservar(uuid, date, timestamptz), escala_entrar_fila(uuid, date, timestamptz),
  escala_cancelar_reserva(uuid, uuid, timestamptz, text),
  escala_marcar_ausencia(uuid, date, timestamptz, text), escala_desfazer_ausencia(uuid, date, timestamptz),
  escala__fila_alvo(uuid, uuid, text), escala_aceitar_oferta(uuid, uuid, text, timestamptz),
  escala_recusar_oferta(uuid, uuid, text, timestamptz), escala_sair_fila(uuid, uuid, timestamptz),
  escala_expirar_ofertas(timestamptz), escala_marcar_utilizadas(timestamptz),
  escala__cancelar_futuro(uuid, text, timestamptz, char), escala__processar_futuro(uuid, timestamptz),
  escala_aplicar_status(uuid, text, timestamptz), escala_mudar_grupo(uuid, char, timestamptz),
  escala_aplicar_materializacao(uuid, jsonb, date, date, text, timestamptz),
  escala_on_status_colaborador()
  from public, anon, authenticated;

-- ── Quem é "eu" no portal: participante vinculado ao auth.uid() ─────────────
-- SECURITY DEFINER para a política não depender de ler escala_participante com RLS.
create or replace function escala_meus_participantes() returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from escala_participante where auth_user_id = auth.uid()
$$;

create or replace function escala_minhas_unidades() returns setof uuid
language sql stable security definer set search_path = public as $$
  select g.unidade_id from escala_participante p join escala_grupo g on g.id = p.grupo_id
  where p.auth_user_id = auth.uid()
$$;

revoke execute on function escala_meus_participantes(), escala_minhas_unidades() from public, anon;
grant execute on function escala_meus_participantes(), escala_minhas_unidades() to authenticated;

-- ── Leitura das próprias linhas (colunas sensíveis ficam de fora) ───────────
grant select (id, grupo_id, ativo) on escala_participante to authenticated;
create policy esc_part_proprio on escala_participante for select to authenticated
  using (id in (select escala_meus_participantes()));

grant select (id, participante_id, data, status, origem, criado_em, atualizado_em) on escala_reserva to authenticated;
create policy esc_reserva_propria on escala_reserva for select to authenticated
  using (participante_id in (select escala_meus_participantes()));

-- sem oferta_token_hash
grant select (id, participante_id, data, entrou_em, status, oferta_expira_em) on escala_fila to authenticated;
create policy esc_fila_propria on escala_fila for select to authenticated
  using (participante_id in (select escala_meus_participantes()));

grant select (id, participante_id, data, em_cima_da_hora, criado_em) on escala_ausencia to authenticated;
create policy esc_ausencia_propria on escala_ausencia for select to authenticated
  using (participante_id in (select escala_meus_participantes()));

-- sem ics_token_hash
grant select (participante_id, lembretes, ics_criado_em) on escala_preferencia to authenticated;
create policy esc_pref_propria on escala_preferencia for select to authenticated
  using (participante_id in (select escala_meus_participantes()));

-- ── Calendário da própria unidade (não é dado pessoal) ──────────────────────
grant select (unidade_id, data, grupo, prazo) on escala_dia to authenticated;
create policy esc_dia_unidade on escala_dia for select to authenticated
  using (unidade_id in (select escala_minhas_unidades()));

grant select (id, data, nome, unidade_id, sem_expediente) on escala_feriado to authenticated;
create policy esc_feriado_unidade on escala_feriado for select to authenticated
  using (
    exists (select 1 from escala_minhas_unidades())
    and (unidade_id is null or unidade_id in (select escala_minhas_unidades()))
  );

-- escala_global, escala_config, escala_grupo, escala_afastamento, escala_email_enviado,
-- escala_log_job, escala_evento e as views: SEM política e SEM grant → negado para anon/authenticated.
