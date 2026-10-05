-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  Escala de Presença — remanejamento por feriado                           ║
-- ║  Segunda/sexta feriado → o grupo do dia vem na quarta (regra no código,   ║
-- ║  src/lib/escala/calendario.ts). Aqui o banco trata o efeito numa quarta   ║
-- ║  que ERA livre e passa a ter grupo:                                       ║
-- ║   • quem é do grupo que chega perde o agendamento (motivo 'grupo' — o     ║
-- ║     lugar fixo já é dele);                                                ║
-- ║   • se ainda passar da capacidade, os agendamentos mais recentes são      ║
-- ║     cancelados até caber (motivo 'remanejamento'), com aviso por e-mail.  ║
-- ║  Só reescreve uma função; nenhuma tabela muda.                            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

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
  v_livres int;
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
      if d.grupo is not null then
        -- quem é do grupo que chega perde o agendamento: o lugar fixo já é dele
        for r in
          update escala_reserva x set status = 'CANCELADA', motivo_cancelamento = 'grupo', atualizado_em = p_agora
          from escala_participante p join escala_grupo g on g.id = p.grupo_id
          where x.participante_id = p.id and x.unidade_id = p_unidade and x.data = d.data
            and x.status = 'CONFIRMADA' and g.letra = d.grupo
          returning x.id, x.participante_id
        loop
          v_canc := v_canc || jsonb_build_object('tipo', 'RESERVA_CANCELADA', 'id', r.id, 'participante_id', r.participante_id,
            'data', d.data, 'motivo', 'grupo');
        end loop;
        update escala_fila x set status = 'CANCELADA', oferta_token_hash = null, atualizado_em = p_agora
        from escala_participante p join escala_grupo g on g.id = p.grupo_id
        where x.participante_id = p.id and x.unidade_id = p_unidade and x.data = d.data
          and x.status in ('AGUARDANDO','OFERECIDA') and g.letra = d.grupo;

        -- capacidade: se o grupo remanejado + agendamentos passarem de N lugares,
        -- cancela os agendamentos mais recentes até caber
        loop
          select vagas_livres into v_livres from escala_ocupacao(p_unidade, d.data, p_agora);
          exit when v_livres is null or v_livres >= 0;
          select x.id, x.participante_id into r from escala_reserva x
          where x.unidade_id = p_unidade and x.data = d.data and x.status = 'CONFIRMADA'
          order by x.criado_em desc, x.id desc limit 1;
          exit when not found;
          update escala_reserva set status = 'CANCELADA', motivo_cancelamento = 'remanejamento', atualizado_em = p_agora
          where id = r.id;
          v_canc := v_canc || jsonb_build_object('tipo', 'RESERVA_CANCELADA', 'id', r.id, 'participante_id', r.participante_id,
            'data', d.data, 'motivo', 'remanejamento');
        end loop;
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

revoke execute on function escala_aplicar_materializacao(uuid, jsonb, date, date, text, timestamptz)
  from public, anon, authenticated;
