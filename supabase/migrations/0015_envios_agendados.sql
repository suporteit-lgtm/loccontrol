-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  0015 — Anexo nos modelos + fila de envios programados                   ║
-- ║                                                                          ║
-- ║  Fluxo: a TI cria a conta → sai o e-mail de credenciais no endereço      ║
-- ║  PESSOAL. Quando o Workspace registra o primeiro login, os e-mails de    ║
-- ║  boas-vindas (chamados) e de acesso ao Quark são agendados para 5 min    ║
-- ║  depois, no endereço CORPORATIVO.                                        ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Anexo opcional por modelo (PDF guardado em base64 — arquivos pequenos)
alter table modelos_email add column if not exists anexo_nome text;
alter table modelos_email add column if not exists anexo_b64 text;

-- ── Modelo: acesso ao QuarkRH (criação de senha) ─────────────────────────────
insert into modelos_email (chave, assunto, corpo) values (
  'acesso-quark',
  'Crie a sua senha de acesso ao QuarkRH',
  'Olá, {primeiro_nome}!

Seu cadastro no QuarkRH está concluído. Agora falta criar a sua senha de acesso ao portal, onde ficam o seu ponto, holerite, férias e solicitações.

🔗 Portal do QuarkRH: [INFORME AQUI O ENDEREÇO DO PORTAL]

Use o seu CPF como usuário e siga a opção de primeiro acesso / criar senha.

Qualquer dificuldade, abra um chamado para a TI.

Equipe de RH · Grupo LOC'
) on conflict (chave) do nothing;

-- ── Modelo: credenciais (vai para o e-mail PESSOAL) ──────────────────────────
insert into modelos_email (chave, assunto, corpo) values (
  'credenciais',
  'Sua conta de e-mail do Grupo LOC',
  'Olá, {primeiro_nome}!

Sua conta de e-mail corporativo do Grupo LOC foi criada.

Endereço: {email}
Senha provisória: {senha}

No primeiro acesso o sistema vai pedir para você trocar essa senha. Entre em https://mail.google.com com o endereço acima.

Assim que você entrar, enviaremos para o seu e-mail corporativo as orientações de acesso ao sistema de chamados e ao QuarkRH.

Equipe de TI · Grupo LOC'
) on conflict (chave) do nothing;

-- ── Fila de envios programados ───────────────────────────────────────────────
create table envios_agendados (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references colaboradores(id) on delete cascade,
  modelo text not null,
  para text not null,
  enviar_em timestamptz not null,
  enviado_em timestamptz,
  tentativas int not null default 0,
  erro text,
  criado_em timestamptz not null default now(),
  -- garante que o mesmo e-mail não seja agendado duas vezes para a mesma pessoa
  unique (colaborador_id, modelo)
);

create index envios_agendados_pendentes_idx
  on envios_agendados (enviar_em) where enviado_em is null;

alter table envios_agendados enable row level security;
create policy sel_envios on envios_agendados for select using (papel_atual() <> '');
create policy mut_envios on envios_agendados for all
  using (papel_atual() in ('Superadmin', 'Admin T.I', 'Admin RH'))
  with check (papel_atual() in ('Superadmin', 'Admin T.I', 'Admin RH'));

comment on table envios_agendados is
  'E-mails com horário programado. O ciclo de sincronização despacha os vencidos.';
