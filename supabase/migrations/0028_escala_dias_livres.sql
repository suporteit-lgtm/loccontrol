-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  Escala de Presença — nova regra (out/2026)                               ║
-- ║   • Segunda e sexta fixas, alternando por semana (sem. 1: seg A / sex B;  ║
-- ║     sem. 2: seg B / sex A).                                              ║
-- ║   • Terça a quinta: dia LIVRE (grupo nulo) — qualquer pessoa agenda.      ║
-- ║   • Sem limite de agendamentos (limite_mensal nulo = sem limite).         ║
-- ║  Só relaxa restrições e reescreve duas funções; nenhum dado é apagado.    ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- dia livre = grupo nulo
alter table escala_dia alter column grupo drop not null;

-- limite opcional; BH · Centro passa a não ter limite
alter table escala_config alter column limite_mensal drop not null;
alter table escala_config alter column limite_mensal set default null;
update escala_config set limite_mensal = null;

-- ── escala__motivo: limite nulo = sem limite (antes: comparação com número) ──
create or replace function escala__motivo(
  p_participante uuid, p_data date, p_agora timestamptz, p_ignorar_fila boolean default false
) returns text
language plpgsql stable as $$
declare
  v record;
  v_dia record;
  v_mes int;
begin
  select p.ativo, g.letra, g.unidade_id, c.status as colab_status, cfg.limite_mensal
    into v
  from escala_participante p
  join escala_grupo g on g.id = p.grupo_id
  join colaboradores c on c.id = p.colaborador_id
  join escala_config cfg on cfg.unidade_id = g.unidade_id
  where p.id = p_participante;

  if not found or not v.ativo or v.colab_status = 'Desligado' then return 'INATIVO'; end if;
  select * into v_dia from escala_dia where unidade_id = v.unidade_id and data = p_data;
  if not found then return 'NAO_E_DIA_UTIL'; end if;
  if p_data <= escala_hoje(p_agora) then return 'DIA_PASSADO'; end if;
  if v.colab_status = 'Afastado' or escala_afastado(p_participante, p_data) then return 'AFASTADO'; end if;
  -- dia livre (grupo nulo): ninguém está "no próprio grupo"
  if v_dia.grupo is not null and v_dia.grupo = v.letra then return 'DIA_DO_PROPRIO_GRUPO'; end if;
  if exists (select 1 from escala_reserva where participante_id = p_participante and data = p_data
             and status in ('CONFIRMADA','UTILIZADA')) then return 'JA_RESERVADO'; end if;
  if not p_ignorar_fila and exists (select 1 from escala_fila where participante_id = p_participante
             and data = p_data and status in ('AGUARDANDO','OFERECIDA')) then return 'JA_NA_FILA'; end if;
  if v.limite_mensal is not null then
    select count(*) into v_mes from escala_reserva
    where participante_id = p_participante and status in ('CONFIRMADA','UTILIZADA')
      and date_trunc('month', data) = date_trunc('month', p_data);
    if v_mes >= v.limite_mensal then return 'LIMITE_MENSAL'; end if;
  end if;
  return null;
end $$;

-- ── "Não vou neste dia": só em dia FIXO do próprio grupo ─────────────────────
-- (antes, `grupo <> letra` com grupo nulo virava NULL e deixava passar)
create or replace function escala_marcar_ausencia(
  p_participante uuid, p_data date, p_agora timestamptz default now(), p_registrado_por text default 'proprio'
) returns jsonb language plpgsql as $$
declare
  v_unidade uuid := escala__unidade(p_participante);
  v_letra char(1);
  v_dia record;
  v_em_cima boolean;
begin
  if v_unidade is null then return jsonb_build_object('ok', false, 'codigo', 'INATIVO'); end if;
  perform escala__lock(v_unidade, p_data);

  select g.letra into v_letra from escala_participante p join escala_grupo g on g.id = p.grupo_id
  where p.id = p_participante and p.ativo;
  if not found then return jsonb_build_object('ok', false, 'codigo', 'INATIVO'); end if;

  select * into v_dia from escala_dia where unidade_id = v_unidade and data = p_data;
  if not found then return jsonb_build_object('ok', false, 'codigo', 'NAO_E_DIA_UTIL'); end if;
  if p_data < escala_hoje(p_agora) then return jsonb_build_object('ok', false, 'codigo', 'DIA_PASSADO'); end if;
  if v_dia.grupo is distinct from v_letra then return jsonb_build_object('ok', false, 'codigo', 'NAO_ESCALADO'); end if;
  if escala_afastado(p_participante, p_data) then return jsonb_build_object('ok', false, 'codigo', 'AFASTADO'); end if;
  if exists (select 1 from escala_ausencia where participante_id = p_participante and data = p_data) then
    return jsonb_build_object('ok', false, 'codigo', 'JA_AUSENTE');
  end if;

  v_em_cima := p_agora >= v_dia.prazo;
  insert into escala_ausencia (participante_id, unidade_id, data, em_cima_da_hora, registrado_por, criado_em)
  values (p_participante, v_unidade, p_data, v_em_cima, p_registrado_por, p_agora);
  return jsonb_build_object('ok', true, 'codigo', 'AUSENCIA_REGISTRADA', 'em_cima_da_hora', v_em_cima,
    'acoes', escala__processar(v_unidade, p_data, p_agora));
end $$;

-- ── Materialização: grupo pode ser nulo (comparações com IS DISTINCT FROM) ──
create or replace function escala_aplicar_materializacao(
  p_unidade uuid, p_dias jsonb, p_de date, p_ate date, p_motivo text default 'feriado', p_agora timestamptz default now()
) returns jsonb language plpgsql as $$
declare
  v_hoje date := escala_hoje(p_agora);
  d record;
  v_removidos jsonb := '[]'::jsonb;
  v_alterados jsonb := '[]'::jsonb;
  v_canc jsonb := '[]'::jsonb;
  r record;
begin
  -- congela o passado guardando quem era do grupo do dia (dia livre: ninguém escalado)
  update escala_dia ed set congelado = true,
    escalados = coalesce((select array_agg(p.id) from escala_participante p join escala_grupo g on g.id = p.grupo_id
                          where g.unidade_id = ed.unidade_id and g.letra = ed.grupo and p.ativo), '{}')
  where ed.unidade_id = p_unidade and ed.data < v_hoje and not ed.congelado;

  -- dias que deixaram de ser úteis (ex.: feriado novo)
  for d in
    select ed.* from escala_dia ed
    where ed.unidade_id = p_unidade and ed.data between p_de and p_ate and not ed.congelado
      and not exists (select 1 from jsonb_array_elements(p_dias) x where (x->>'data')::date = ed.data)
    order by ed.data
  loop
    perform escala__lock(p_unidade, d.data);
    for r in update escala_reserva set status = 'CANCELADA', motivo_cancelamento = p_motivo, atualizado_em = p_agora
             where unidade_id = p_unidade and data = d.data and status = 'CONFIRMADA' returning id, participante_id loop
      v_canc := v_canc || jsonb_build_object('tipo', 'RESERVA_CANCELADA', 'id', r.id, 'participante_id', r.participante_id,
        'data', d.data, 'motivo', p_motivo);
    end loop;
    for r in update escala_fila set status = 'CANCELADA', oferta_token_hash = null, atualizado_em = p_agora
             where unidade_id = p_unidade and data = d.data and status in ('AGUARDANDO','OFERECIDA') returning id, participante_id loop
      v_canc := v_canc || jsonb_build_object('tipo', 'FILA_CANCELADA', 'id', r.id, 'participante_id', r.participante_id,
        'data', d.data, 'motivo', p_motivo);
    end loop;
    delete from escala_ausencia where unidade_id = p_unidade and data = d.data;
    delete from escala_dia where unidade_id = p_unidade and data = d.data;
    v_removidos := v_removidos || jsonb_build_object('data', d.data,
      'google_event_id', d.google_event_id, 'google_event_teste_id', d.google_event_teste_id);
  end loop;

  -- novos dias e grupos alterados
  for d in
    select (x->>'data')::date as data, nullif(x->>'grupo', '')::char(1) as grupo, (x->>'prazo')::timestamptz as prazo
    from jsonb_array_elements(p_dias) x
    where (x->>'data')::date between p_de and p_ate
    order by 1
  loop
    perform escala__lock(p_unidade, d.data);
    select * into r from escala_dia where unidade_id = p_unidade and data = d.data;
    if not found then
      insert into escala_dia (unidade_id, data, grupo, prazo) values (p_unidade, d.data, d.grupo, d.prazo);
    elsif r.congelado then
      continue;                                               -- passado nunca muda
    elsif r.grupo is distinct from d.grupo then
      update escala_dia set grupo = d.grupo, prazo = d.prazo, sync_hash = null where unidade_id = p_unidade and data = d.data;
      v_alterados := v_alterados || to_jsonb(d.data);
      -- quem reservou/entrou na fila e agora é do grupo fixo do dia perde a reserva (o lugar já é dele)
      if d.grupo is not null then
        for r in
          update escala_reserva x set status = 'CANCELADA', motivo_cancelamento = p_motivo, atualizado_em = p_agora
          from escala_participante p join escala_grupo g on g.id = p.grupo_id
          where x.participante_id = p.id and x.unidade_id = p_unidade and x.data = d.data
            and x.status = 'CONFIRMADA' and g.letra = d.grupo
          returning x.id, x.participante_id
        loop
          v_canc := v_canc || jsonb_build_object('tipo', 'RESERVA_CANCELADA', 'id', r.id, 'participante_id', r.participante_id,
            'data', d.data, 'motivo', p_motivo);
        end loop;
        update escala_fila x set status = 'CANCELADA', oferta_token_hash = null, atualizado_em = p_agora
        from escala_participante p join escala_grupo g on g.id = p.grupo_id
        where x.participante_id = p.id and x.unidade_id = p_unidade and x.data = d.data
          and x.status in ('AGUARDANDO','OFERECIDA') and g.letra = d.grupo;
      end if;
      -- ausências só existem para quem é do grupo fixo do dia
      delete from escala_ausencia a using escala_participante p, escala_grupo g
      where a.participante_id = p.id and g.id = p.grupo_id and a.unidade_id = p_unidade and a.data = d.data
        and g.letra is distinct from d.grupo;
      perform escala__processar(p_unidade, d.data, p_agora);
    elsif r.prazo <> d.prazo then
      update escala_dia set prazo = d.prazo where unidade_id = p_unidade and data = d.data;
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'removidos', v_removidos, 'alterados', v_alterados, 'canceladas', v_canc,
    'acoes', escala__processar_futuro(p_unidade, p_agora));
end $$;

-- as funções recriadas mantêm a regra de 0026: só o servidor executa
revoke execute on function
  escala__motivo(uuid, date, timestamptz, boolean),
  escala_marcar_ausencia(uuid, date, timestamptz, text),
  escala_aplicar_materializacao(uuid, jsonb, date, date, text, timestamptz)
  from public, anon, authenticated;
