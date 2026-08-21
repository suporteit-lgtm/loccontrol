-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  0014 — Modelo do e-mail de boas-vindas                                  ║
-- ║                                                                          ║
-- ║  Enviado automaticamente para a conta recém-criada quando a TI ativa o   ║
-- ║  colaborador. O texto é editável em Configurações (somente admins).      ║
-- ║  Placeholders: {nome} {primeiro_nome} {email} {cargo} {unidade}          ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

create table modelos_email (
  chave text primary key,
  assunto text not null,
  corpo text not null,
  atualizado_em timestamptz not null default now()
);

alter table modelos_email enable row level security;
create policy sel_modelo_email on modelos_email for select using (papel_atual() <> '');
create policy mut_modelo_email on modelos_email for all
  using (papel_atual() in ('Superadmin', 'Admin T.I', 'Admin RH'))
  with check (papel_atual() in ('Superadmin', 'Admin T.I', 'Admin RH'));

insert into modelos_email (chave, assunto, corpo) values (
  'boas-vindas',
  'Bem-vindo(a) ao Grupo LOC — sua conta de e-mail',
  'Olá, {primeiro_nome}!

Seja bem-vindo(a) ao Grupo LOC. Sua conta de e-mail corporativo ({email}) acabou de ser criada.

Precisando de qualquer suporte de TI — equipamento, acesso a sistema, dúvida técnica — abra um chamado pelo nosso sistema interno. É por lá que o time acompanha e resolve tudo:

1. Acesse o sistema de chamados do Grupo LOC
2. Entre com este e-mail corporativo
3. Descreva o que precisa e envie — o time de TI recebe na hora

Guarde este e-mail para consultar depois.

Bom trabalho!
Equipe de TI · Grupo LOC'
);
