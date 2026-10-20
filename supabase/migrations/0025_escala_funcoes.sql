-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  Escala de Presença — regras transacionais (reservas, fila, ausências)    ║
-- ║                                                                          ║
-- ║  Toda ocupação de vaga acontece aqui, dentro de uma transação com          ║
-- ║  pg_advisory_xact_lock(unidade, data): duas reservas simultâneas nunca     ║
-- ║  passam da capacidade. O servidor (service_role) chama estas funções       ║
-- ║  depois de validar a sessão; anon/authenticated NÃO podem executá-las      ║
-- ║  (ver 0026). Cada função devolve jsonb { ok, codigo, ..., acoes[] } —      ║
-- ║  `acoes` lista atribuições/ofertas para o servidor mandar os e-mails.      ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ── Utilitários ──────────────────────────────────────────────────────────────
create or replace function escala_hoje(p_agora timestamptz) returns date
language sql stable as $$ select (p_agora at time zone 'America/Sao_Paulo')::date $$;

create or replace function escala__lock(p_unidade uuid, p_data date) returns void
language sql as $$ select pg_advisory_xact_lock(hashtextextended('escala:' || p_unidade || ':' || p_data, 0)) $$;

create or replace function escala_afastado(p_participante uuid, p_data date) returns boolean
language sql stable as $$
  select exists (
    select 1 from escala_afastamento a
    where a.participante_id = p_participante and a.inicio <= p_data and (a.fim is null or a.fim >= p_data)
  )
$$;

-- Ocupação de um dia (fórmula da seção 2)
--   vagas_livres      = capacidade − (escalados − ausências − afastados) − reservas confirmadas
--   vagas_disponiveis = vagas_livres − ofertas pendentes (oferta segura o lugar até expirar)
create or replace function escala_ocupacao(p_unidade uuid, p_data date, p_agora timestamptz default now())
returns table (
  grupo char(1), capacidade int, escalados int, afastados int, ausencias int, ausencias_em_cima int,
  reservas int, ofertas_pendentes int, fila_aguardando int, vagas_livres int, vagas_disponiveis int
)
language sql stable as $$
  with d as (
    select ed.grupo, cfg.capacidade from escala_dia ed
    join escala_config cfg on cfg.unidade_id = ed.unidade_id
    where ed.unidade_id = p_unidade and ed.data = p_data
  ),
  esc as (
    select p.id, escala_afastado(p.id, p_data) as afastado
    from escala_participante p join escala_grupo g on g.id = p.grupo_id, d
    where g.unidade_id = p_unidade and g.letra = d.grupo and p.ativo
  ),
  n as (
    select
      (select count(*) from esc)::int as escalados,
      (select count(*) from esc where afastado)::int as afastados,
      (select count(*) from escala_ausencia a join esc on esc.id = a.participante_id
         where a.data = p_data and not esc.afastado)::int as ausencias,
      (select count(*) from escala_ausencia a join esc on esc.id = a.participante_id
         where a.data = p_data and not esc.afastado and a.em_cima_da_hora)::int as ausencias_em_cima,
      (select count(*) from escala_reserva r
         where r.unidade_id = p_unidade and r.data = p_data and r.status in ('CONFIRMADA','UTILIZADA'))::int as reservas,
      (select count(*) from escala_fila f
         where f.unidade_id = p_unidade and f.data = p_data and f.status = 'OFERECIDA'
           and f.oferta_expira_em > p_agora)::int as ofertas,
      (select count(*) from escala_fila f
         where f.unidade_id = p_unidade and f.data = p_data and f.status = 'AGUARDANDO')::int as aguardando
  )
  select d.grupo, d.capacidade, n.escalados, n.afastados, n.ausencias, n.ausencias_em_cima, n.reservas, n.ofertas,
         n.aguardando,
         d.capacidade - greatest(0, n.escalados - n.ausencias - n.afastados) - n.reservas,
         d.capacidade - greatest(0, n.escalados - n.ausencias - n.afastados) - n.reservas - n.ofertas
  from d, n
$$;

-- Posição na fila (1 = próximo). Conta quem está aguardando ou com oferta na frente.
create or replace function escala_posicao_fila(p_fila uuid) returns int
language sql stable as $$
  select count(*)::int from escala_fila o, escala_fila f
  where f.id = p_fila and o.unidade_id = f.unidade_id and o.data = f.data
    and o.status in ('AGUARDANDO','OFERECIDA') and (o.entrou_em, o.id) <= (f.entrou_em, f.id)
$$;

-- Motivo que impede reservar/entrar na fila (null = elegível). Mesmas regras de src/lib/escala/calendario.ts
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
  if v_dia.grupo = v.letra then return 'DIA_DO_PROPRIO_GRUPO'; end if;
  if exists (select 1 from escala_reserva where participante_id = p_participante and data = p_data
             and status in ('CONFIRMADA','UTILIZADA')) then return 'JA_RESERVADO'; end if;
  if not p_ignorar_fila and exists (select 1 from escala_fila where participante_id = p_participante
             and data = p_data and status in ('AGUARDANDO','OFERECIDA')) then return 'JA_NA_FILA'; end if;
  select count(*) into v_mes from escala_reserva
  where participante_id = p_participante and status in ('CONFIRMADA','UTILIZADA')
    and date_trunc('month', data) = date_trunc('month', p_data);
  if v_mes >= v.limite_mensal then return 'LIMITE_MENSAL'; end if;
  return null;
end $$;

-- ── Núcleo: distribui vagas abertas para a fila (exige lock já obtido) ───────
create or replace function escala__processar(p_unidade uuid, p_data date, p_agora timestamptz)
returns jsonb
language plpgsql
set search_path = public, extensions
as $$
declare
  v_dia record;
  v_cfg record;
  v_occ record;
  f record;
  v_motivo text;
  v_reserva uuid;
  v_token text;
  v_expira timestamptz;
  v_acoes jsonb := '[]'::jsonb;
begin
  -- a fila do dia é encerrada às 00:00 do próprio dia
  if p_data <= escala_hoje(p_agora) then return v_acoes; end if;
  select * into v_dia from escala_dia where unidade_id = p_unidade and data = p_data;
  if not found then return v_acoes; end if;
  select * into v_cfg from escala_config where unidade_id = p_unidade;

  loop
    select * into v_occ from escala_ocupacao(p_unidade, p_data, p_agora);
    exit when v_occ.vagas_disponiveis is null or v_occ.vagas_disponiveis <= 0;

    select * into f from escala_fila
    where unidade_id = p_unidade and data = p_data and status = 'AGUARDANDO'
    order by entrou_em, id limit 1 for update;
    exit when not found;

    v_motivo := escala__motivo(f.participante_id, p_data, p_agora, true);
    if v_motivo is not null then
      update escala_fila set status = 'CANCELADA', atualizado_em = p_agora where id = f.id;
      v_acoes := v_acoes || jsonb_build_object('tipo', 'FILA_INVALIDADA', 'fila_id', f.id,
        'participante_id', f.participante_id, 'data', p_data, 'motivo', v_motivo);
      continue;
    end if;

    if p_agora < v_dia.prazo then
      -- antes do prazo: o primeiro da fila recebe a vaga automaticamente
      insert into escala_reserva (participante_id, unidade_id, data, status, origem, criado_em, atualizado_em)
      values (f.participante_id, p_unidade, p_data, 'CONFIRMADA', 'FILA', p_agora, p_agora)
      returning id into v_reserva;
      update escala_fila set status = 'ATENDIDA', atualizado_em = p_agora where id = f.id;
      v_acoes := v_acoes || jsonb_build_object('tipo', 'ATRIBUIDA', 'fila_id', f.id, 'reserva_id', v_reserva,
        'participante_id', f.participante_id, 'data', p_data);
    else
      -- depois do prazo: oferta com validade (nunca passa de 00:00 do dia da vaga)
      v_token := encode(gen_random_bytes(24), 'hex');
      v_expira := least(p_agora + make_interval(mins => v_cfg.oferta_validade_min),
                        (p_data::timestamp) at time zone 'America/Sao_Paulo');
      update escala_fila set status = 'OFERECIDA', oferta_expira_em = v_expira,
        oferta_token_hash = encode(digest(v_token, 'sha256'), 'hex'), atualizado_em = p_agora
      where id = f.id;
      v_acoes := v_acoes || jsonb_build_object('tipo', 'OFERECIDA', 'fila_id', f.id,
        'participante_id', f.participante_id, 'data', p_data, 'expira_em', v_expira, 'token', v_token);
    end if;
  end loop;
  return v_acoes;
end $$;

create or replace function escala_processar_vaga(p_unidade uuid, p_data date, p_agora timestamptz default now())
returns jsonb language plpgsql as $$
begin
  perform escala__lock(p_unidade, p_data);
  return jsonb_build_object('ok', true, 'acoes', escala__processar(p_unidade, p_data, p_agora));
end $$;

-- Unidade do participante (ou null)
create or replace function escala__unidade(p_participante uuid) returns uuid
language sql stable as $$
  select g.unidade_id from escala_participante p join escala_grupo g on g.id = p.grupo_id where p.id = p_participante
$$;

-- ── Reservar ─────────────────────────────────────────────────────────────────
create or replace function escala_reservar(p_participante uuid, p_data date, p_agora timestamptz default now())
returns jsonb language plpgsql as $$
declare
  v_unidade uuid := escala__unidade(p_participante);
  v_motivo text;
  v_occ record;
  v_id uuid;
begin
  if v_unidade is null then return jsonb_build_object('ok', false, 'codigo', 'INATIVO'); end if;
  perform escala__lock(v_unidade, p_data);

  v_motivo := escala__motivo(p_participante, p_data, p_agora);
  if v_motivo is not null then return jsonb_build_object('ok', false, 'codigo', v_motivo); end if;

  select * into v_occ from escala_ocupacao(v_unidade, p_data, p_agora);
  -- FIFO: se já existe fila, ninguém "fura" — a vaga é da fila
  if v_occ.vagas_disponiveis <= 0 or v_occ.fila_aguardando > 0 then
    return jsonb_build_object('ok', false, 'codigo', 'LOTADO', 'fila', v_occ.fila_aguardando);
  end if;

  insert into escala_reserva (participante_id, unidade_id, data, criado_em, atualizado_em)
  values (p_participante, v_unidade, p_data, p_agora, p_agora) returning id into v_id;
  return jsonb_build_object('ok', true, 'codigo', 'CONFIRMADA', 'reserva_id', v_id);
end $$;

-- ── Entrar na fila (só quando o dia está lotado) ────────────────────────────
create or replace function escala_entrar_fila(p_participante uuid, p_data date, p_agora timestamptz default now())
returns jsonb language plpgsql as $$
declare
  v_unidade uuid := escala__unidade(p_participante);
  v_motivo text;
  v_occ record;
  v_id uuid;
begin
  if v_unidade is null then return jsonb_build_object('ok', false, 'codigo', 'INATIVO'); end if;
  perform escala__lock(v_unidade, p_data);

  v_motivo := escala__motivo(p_participante, p_data, p_agora);
  if v_motivo is not null then return jsonb_build_object('ok', false, 'codigo', v_motivo); end if;

  select * into v_occ from escala_ocupacao(v_unidade, p_data, p_agora);
  if v_occ.vagas_disponiveis > 0 and v_occ.fila_aguardando = 0 then
    return jsonb_build_object('ok', false, 'codigo', 'HA_VAGAS');
  end if;

  insert into escala_fila (participante_id, unidade_id, data, entrou_em, atualizado_em)
  values (p_participante, v_unidade, p_data, clock_timestamp(), p_agora) returning id into v_id;
  return jsonb_build_object('ok', true, 'codigo', 'NA_FILA', 'fila_id', v_id, 'posicao', escala_posicao_fila(v_id));
end $$;

-- ── Cancelar reserva (p_participante null = RH/admin, sem trava de prazo) ───
create or replace function escala_cancelar_reserva(
  p_reserva uuid, p_participante uuid, p_agora timestamptz default now(), p_motivo text default 'pessoa'
) returns jsonb language plpgsql as $$
declare
  r record;
  v_prazo timestamptz;
begin
  select * into r from escala_reserva where id = p_reserva;
  if not found or (p_participante is not null and r.participante_id <> p_participante) then
    return jsonb_build_object('ok', false, 'codigo', 'NAO_ENCONTRADA');
  end if;
  perform escala__lock(r.unidade_id, r.data);
  select * into r from escala_reserva where id = p_reserva for update;
  if r.status <> 'CONFIRMADA' then return jsonb_build_object('ok', false, 'codigo', 'STATUS_INVALIDO', 'status', r.status); end if;

  select prazo into v_prazo from escala_dia where unidade_id = r.unidade_id and data = r.data;
  if p_participante is not null and v_prazo is not null and p_agora >= v_prazo then
    return jsonb_build_object('ok', false, 'codigo', 'PRAZO_ENCERRADO', 'prazo', v_prazo);
  end if;

  update escala_reserva set status = 'CANCELADA', motivo_cancelamento = p_motivo, atualizado_em = p_agora
  where id = p_reserva;
  return jsonb_build_object('ok', true, 'codigo', 'CANCELADA',
    'acoes', escala__processar(r.unidade_id, r.data, p_agora));
end $$;

-- ── "Não vou neste dia" (escalado) ───────────────────────────────────────────
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
  if v_dia.grupo <> v_letra then return jsonb_build_object('ok', false, 'codigo', 'NAO_ESCALADO'); end if;
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

-- Desfazer ausência: só se o lugar ainda estiver livre
create or replace function escala_desfazer_ausencia(p_participante uuid, p_data date, p_agora timestamptz default now())
returns jsonb language plpgsql as $$
declare
  v_unidade uuid := escala__unidade(p_participante);
  v_occ record;
begin
  if v_unidade is null then return jsonb_build_object('ok', false, 'codigo', 'INATIVO'); end if;
  perform escala__lock(v_unidade, p_data);
  if p_data < escala_hoje(p_agora) then return jsonb_build_object('ok', false, 'codigo', 'DIA_PASSADO'); end if;
  if not exists (select 1 from escala_ausencia where participante_id = p_participante and data = p_data) then
    return jsonb_build_object('ok', false, 'codigo', 'NAO_ENCONTRADA');
  end if;
  select * into v_occ from escala_ocupacao(v_unidade, p_data, p_agora);
  if v_occ.vagas_disponiveis <= 0 then return jsonb_build_object('ok', false, 'codigo', 'VAGA_JA_OCUPADA'); end if;
  delete from escala_ausencia where participante_id = p_participante and data = p_data;
  return jsonb_build_object('ok', true, 'codigo', 'AUSENCIA_DESFEITA');
end $$;

-- ── Ofertas: aceitar / recusar / sair da fila ────────────────────────────────
-- Identifica a entrada por id + participante (portal) ou pelo token do e-mail.
create or replace function escala__fila_alvo(p_fila uuid, p_participante uuid, p_token text)
returns escala_fila language sql stable set search_path = public, extensions as $$
  select * from escala_fila
  where (p_token is not null and oferta_token_hash = encode(digest(p_token, 'sha256'), 'hex'))
     or (p_token is null and id = p_fila and participante_id = p_participante)
  limit 1
$$;

create or replace function escala_aceitar_oferta(
  p_fila uuid, p_participante uuid, p_token text default null, p_agora timestamptz default now()
) returns jsonb language plpgsql as $$
declare
  f escala_fila;
  v_motivo text;
  v_id uuid;
begin
  f := escala__fila_alvo(p_fila, p_participante, p_token);
  if f.id is null then return jsonb_build_object('ok', false, 'codigo', 'NAO_ENCONTRADA'); end if;
  perform escala__lock(f.unidade_id, f.data);
  select * into f from escala_fila where id = f.id for update;

  if f.status <> 'OFERECIDA' then return jsonb_build_object('ok', false, 'codigo', 'STATUS_INVALIDO', 'status', f.status); end if;
  if f.oferta_expira_em <= p_agora then
    update escala_fila set status = 'EXPIRADA', atualizado_em = p_agora where id = f.id;
    return jsonb_build_object('ok', false, 'codigo', 'OFERTA_EXPIRADA',
      'acoes', escala__processar(f.unidade_id, f.data, p_agora));
  end if;

  v_motivo := escala__motivo(f.participante_id, f.data, p_agora, true);
  if v_motivo is not null then
    update escala_fila set status = 'CANCELADA', atualizado_em = p_agora where id = f.id;
    return jsonb_build_object('ok', false, 'codigo', v_motivo,
      'acoes', escala__processar(f.unidade_id, f.data, p_agora));
  end if;

  -- a oferta já segurava o lugar: aceitar nunca passa da capacidade
  insert into escala_reserva (participante_id, unidade_id, data, status, origem, criado_em, atualizado_em)
  values (f.participante_id, f.unidade_id, f.data, 'CONFIRMADA', 'FILA', p_agora, p_agora) returning id into v_id;
  update escala_fila set status = 'ATENDIDA', oferta_token_hash = null, atualizado_em = p_agora where id = f.id;
  return jsonb_build_object('ok', true, 'codigo', 'CONFIRMADA', 'reserva_id', v_id,
    'participante_id', f.participante_id, 'data', f.data);
end $$;

create or replace function escala_recusar_oferta(
  p_fila uuid, p_participante uuid, p_token text default null, p_agora timestamptz default now()
) returns jsonb language plpgsql as $$
declare
  f escala_fila;
begin
  f := escala__fila_alvo(p_fila, p_participante, p_token);
  if f.id is null then return jsonb_build_object('ok', false, 'codigo', 'NAO_ENCONTRADA'); end if;
  perform escala__lock(f.unidade_id, f.data);
  select * into f from escala_fila where id = f.id for update;
  if f.status <> 'OFERECIDA' then return jsonb_build_object('ok', false, 'codigo', 'STATUS_INVALIDO', 'status', f.status); end if;
  update escala_fila set status = 'CANCELADA', oferta_token_hash = null, atualizado_em = p_agora where id = f.id;
  -- a vaga passa ao próximo na hora
  return jsonb_build_object('ok', true, 'codigo', 'RECUSADA', 'acoes', escala__processar(f.unidade_id, f.data, p_agora));
end $$;

create or replace function escala_sair_fila(p_fila uuid, p_participante uuid, p_agora timestamptz default now())
returns jsonb language plpgsql as $$
declare
  f escala_fila;
  v_status text;
begin
  select * into f from escala_fila where id = p_fila and (p_participante is null or participante_id = p_participante);
  if not found then return jsonb_build_object('ok', false, 'codigo', 'NAO_ENCONTRADA'); end if;
  perform escala__lock(f.unidade_id, f.data);
  select status into v_status from escala_fila where id = f.id for update;
  if v_status not in ('AGUARDANDO','OFERECIDA') then
    return jsonb_build_object('ok', false, 'codigo', 'STATUS_INVALIDO', 'status', v_status);
  end if;
  update escala_fila set status = 'CANCELADA', oferta_token_hash = null, atualizado_em = p_agora where id = f.id;
  return jsonb_build_object('ok', true, 'codigo', 'SAIU_DA_FILA',
    'acoes', case when v_status = 'OFERECIDA' then escala__processar(f.unidade_id, f.data, p_agora) else '[]'::jsonb end);
end $$;

-- ── Jobs ─────────────────────────────────────────────────────────────────────
-- Expira ofertas vencidas (passando a vaga adiante) e encerra as filas de hoje/passado.
create or replace function escala_expirar_ofertas(p_agora timestamptz default now())
returns jsonb language plpgsql as $$
declare
  d record;
  v_expiradas int := 0;
  v_n int;
  v_encerradas int;
  v_acoes jsonb := '[]'::jsonb;
begin
  for d in
    select distinct unidade_id, data from escala_fila
    where status = 'OFERECIDA' and oferta_expira_em <= p_agora order by data, unidade_id
  loop
    perform escala__lock(d.unidade_id, d.data);
    update escala_fila set status = 'EXPIRADA', oferta_token_hash = null, atualizado_em = p_agora
    where unidade_id = d.unidade_id and data = d.data and status = 'OFERECIDA' and oferta_expira_em <= p_agora;
    get diagnostics v_n = row_count;
    v_expiradas := v_expiradas + v_n;
    v_acoes := v_acoes || jsonb_build_array(jsonb_build_object('tipo', 'OFERTAS_EXPIRADAS',
      'unidade_id', d.unidade_id, 'data', d.data, 'quantidade', v_n))
      || escala__processar(d.unidade_id, d.data, p_agora);
  end loop;

  update escala_fila set status = 'EXPIRADA', oferta_token_hash = null, atualizado_em = p_agora
  where status in ('AGUARDANDO','OFERECIDA') and data <= escala_hoje(p_agora);
  get diagnostics v_encerradas = row_count;

  return jsonb_build_object('ok', true, 'expiradas', v_expiradas, 'encerradas', v_encerradas, 'acoes', v_acoes);
end $$;

create or replace function escala_marcar_utilizadas(p_agora timestamptz default now())
returns int language plpgsql as $$
declare v_n int;
begin
  update escala_reserva set status = 'UTILIZADA', atualizado_em = p_agora
  where status = 'CONFIRMADA' and data <= escala_hoje(p_agora);
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- Cancela reservas e filas futuras de um participante (afastamento, desligamento, mudança de grupo).
-- p_so_grupo: se informado, só os dias cujo grupo é essa letra.
create or replace function escala__cancelar_futuro(
  p_participante uuid, p_motivo text, p_agora timestamptz, p_so_grupo char(1) default null
) returns jsonb language plpgsql as $$
declare
  r record;
  v_out jsonb := '[]'::jsonb;
begin
  for r in
    select x.id, x.data, x.unidade_id, 'RESERVA' as tipo from escala_reserva x
    join escala_dia ed on ed.unidade_id = x.unidade_id and ed.data = x.data
    where x.participante_id = p_participante and x.status = 'CONFIRMADA' and x.data > escala_hoje(p_agora)
      and (p_so_grupo is null or ed.grupo = p_so_grupo)
    union all
    select x.id, x.data, x.unidade_id, 'FILA' from escala_fila x
    join escala_dia ed on ed.unidade_id = x.unidade_id and ed.data = x.data
    where x.participante_id = p_participante and x.status in ('AGUARDANDO','OFERECIDA') and x.data > escala_hoje(p_agora)
      and (p_so_grupo is null or ed.grupo = p_so_grupo)
    order by 2
  loop
    perform escala__lock(r.unidade_id, r.data);
    if r.tipo = 'RESERVA' then
      update escala_reserva set status = 'CANCELADA', motivo_cancelamento = p_motivo, atualizado_em = p_agora where id = r.id;
    else
      update escala_fila set status = 'CANCELADA', oferta_token_hash = null, atualizado_em = p_agora where id = r.id;
    end if;
    v_out := v_out || jsonb_build_object('tipo', r.tipo || '_CANCELADA', 'id', r.id, 'data', r.data,
      'participante_id', p_participante, 'motivo', p_motivo);
  end loop;
  return v_out;
end $$;

-- Redistribui as vagas de todos os dias futuros com fila (ordem por data → sem deadlock)
create or replace function escala__processar_futuro(p_unidade uuid, p_agora timestamptz)
returns jsonb language plpgsql as $$
declare
  d record;
  v_acoes jsonb := '[]'::jsonb;
begin
  for d in
    select distinct data from escala_fila
    where unidade_id = p_unidade and status = 'AGUARDANDO' and data > escala_hoje(p_agora) order by data
  loop
    perform escala__lock(p_unidade, d.data);
    v_acoes := v_acoes || escala__processar(p_unidade, d.data, p_agora);
  end loop;
  return v_acoes;
end $$;

-- Status do colaborador no LocControl → escala (chamada pelo processador de eventos)
create or replace function escala_aplicar_status(p_colaborador uuid, p_status text, p_agora timestamptz default now())
returns jsonb language plpgsql as $$
declare
  p record;
  v_hoje date := escala_hoje(p_agora);
  v_canc jsonb := '[]'::jsonb;
begin
  select ep.id, g.unidade_id into p from escala_participante ep join escala_grupo g on g.id = ep.grupo_id
  where ep.colaborador_id = p_colaborador;
  if not found then return jsonb_build_object('ok', true, 'codigo', 'NAO_PARTICIPA'); end if;

  if p_status = 'Afastado' then
    if not exists (select 1 from escala_afastamento where participante_id = p.id and fim is null) then
      insert into escala_afastamento (participante_id, inicio) values (p.id, v_hoje);
    end if;
    v_canc := escala__cancelar_futuro(p.id, 'afastado', p_agora);
  elsif p_status = 'Desligado' then
    update escala_afastamento set fim = greatest(inicio, v_hoje) where participante_id = p.id and fim is null;
    update escala_participante set ativo = false, atualizado_em = p_agora where id = p.id;
    v_canc := escala__cancelar_futuro(p.id, 'desligado', p_agora);
  else
    -- voltou a Ativo: encerra o afastamento aberto
    update escala_afastamento set fim = greatest(inicio, v_hoje - 1) where participante_id = p.id and fim is null;
  end if;

  return jsonb_build_object('ok', true, 'codigo', 'STATUS_APLICADO', 'canceladas', v_canc,
    'acoes', escala__processar_futuro(p.unidade_id, p_agora));
end $$;

-- Mudança de grupo: reservas/filas futuras em dias do NOVO grupo deixam de fazer sentido
create or replace function escala_mudar_grupo(p_participante uuid, p_letra char(1), p_agora timestamptz default now())
returns jsonb language plpgsql as $$
declare
  v_unidade uuid := escala__unidade(p_participante);
  v_grupo uuid;
  v_canc jsonb;
begin
  select id into v_grupo from escala_grupo where unidade_id = v_unidade and letra = p_letra;
  if v_grupo is null then return jsonb_build_object('ok', false, 'codigo', 'GRUPO_INEXISTENTE'); end if;
  update escala_participante set grupo_id = v_grupo, atualizado_em = p_agora where id = p_participante;
  v_canc := escala__cancelar_futuro(p_participante, 'grupo', p_agora, p_letra);
  return jsonb_build_object('ok', true, 'codigo', 'GRUPO_ALTERADO', 'canceladas', v_canc,
    'acoes', escala__processar_futuro(v_unidade, p_agora));
end $$;

-- ── Materialização (o cálculo vem de src/lib/escala/calendario.ts) ──────────
-- p_dias: [{ "data": "AAAA-MM-DD", "grupo": "A", "prazo": "<timestamptz>" }] para [p_de, p_ate]
-- Congela o passado, remove dias que deixaram de ser úteis e corrige grupos alterados,
-- cancelando reservas e filas que ficaram inválidas.
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
  -- congela o passado guardando quem era do grupo do dia (o dashboard não muda se alguém trocar de grupo depois)
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
    select (x->>'data')::date as data, (x->>'grupo')::char(1) as grupo, (x->>'prazo')::timestamptz as prazo
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
    elsif r.grupo <> d.grupo then
      update escala_dia set grupo = d.grupo, prazo = d.prazo, sync_hash = null where unidade_id = p_unidade and data = d.data;
      v_alterados := v_alterados || to_jsonb(d.data);
      -- quem reservou/entrou na fila e agora é do grupo do dia perde a reserva; ausências do grupo antigo caem
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
      delete from escala_ausencia a using escala_participante p, escala_grupo g
      where a.participante_id = p.id and g.id = p.grupo_id and a.unidade_id = p_unidade and a.data = d.data
        and g.letra <> d.grupo;
      perform escala__processar(p_unidade, d.data, p_agora);
    elsif r.prazo <> d.prazo then
      update escala_dia set prazo = d.prazo where unidade_id = p_unidade and data = d.data;
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'removidos', v_removidos, 'alterados', v_alterados, 'canceladas', v_canc,
    'acoes', escala__processar_futuro(p_unidade, p_agora));
end $$;

-- ── Views para o dashboard (só o servidor lê; security_invoker respeita RLS) ─
-- Fato por pessoa e dia: escalado (do grupo do dia) ou reserva.
create or replace view escala_v_presenca with (security_invoker = true) as
select ed.unidade_id, ed.data, ed.grupo as grupo_do_dia, p.id as participante_id, g.letra as grupo_pessoa,
       'ESCALADO'::text as tipo,
       escala_afastado(p.id, ed.data) as afastado,
       (a.id is not null) as ausente,
       coalesce(a.em_cima_da_hora, false) as ausente_em_cima,
       (not escala_afastado(p.id, ed.data) and a.id is null) as presente
from escala_dia ed
cross join lateral (
  -- dia congelado: a foto; dia futuro/hoje: quem é do grupo agora
  select unnest(ed.escalados) where ed.congelado
  union all
  select p2.id from escala_participante p2 join escala_grupo g2 on g2.id = p2.grupo_id
  where not ed.congelado and g2.unidade_id = ed.unidade_id and g2.letra = ed.grupo and p2.ativo
) e(pid)
join escala_participante p on p.id = e.pid
join escala_grupo g on g.id = p.grupo_id
left join escala_ausencia a on a.participante_id = p.id and a.data = ed.data
union all
select r.unidade_id, r.data, ed.grupo, r.participante_id, g.letra, 'RESERVA',
       false, false, false, r.status in ('CONFIRMADA','UTILIZADA')
from escala_reserva r
join escala_dia ed on ed.unidade_id = r.unidade_id and ed.data = r.data
join escala_participante p on p.id = r.participante_id
join escala_grupo g on g.id = p.grupo_id
where r.status in ('CONFIRMADA','UTILIZADA');

-- Agregado por dia
create or replace view escala_v_dia with (security_invoker = true) as
select ed.unidade_id, ed.data, ed.grupo, cfg.capacidade,
       count(*) filter (where v.tipo = 'ESCALADO') as escalados,
       count(*) filter (where v.tipo = 'ESCALADO' and v.afastado) as afastados,
       count(*) filter (where v.tipo = 'ESCALADO' and v.ausente and not v.afastado) as ausencias,
       count(*) filter (where v.tipo = 'ESCALADO' and v.ausente_em_cima and not v.afastado) as ausencias_em_cima,
       count(*) filter (where v.tipo = 'RESERVA') as reservas,
       count(*) filter (where v.presente) as presentes,
       (select count(*) from escala_fila f where f.unidade_id = ed.unidade_id and f.data = ed.data) as fila_total,
       (select count(*) from escala_fila f where f.unidade_id = ed.unidade_id and f.data = ed.data
          and f.status = 'EXPIRADA') as fila_sem_atendimento,
       (select count(*) from escala_fila f where f.unidade_id = ed.unidade_id and f.data = ed.data
          and f.status = 'EXPIRADA' and f.oferta_expira_em is not null) as ofertas_expiradas,
       (select count(*) from escala_fila f where f.unidade_id = ed.unidade_id and f.data = ed.data
          and f.oferta_expira_em is not null) as ofertas
from escala_dia ed
join escala_config cfg on cfg.unidade_id = ed.unidade_id
left join escala_v_presenca v on v.unidade_id = ed.unidade_id and v.data = ed.data
group by ed.unidade_id, ed.data, ed.grupo, cfg.capacidade;
