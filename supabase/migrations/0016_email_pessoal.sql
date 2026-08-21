-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  0016 — E-mail pessoal do colaborador                                    ║
-- ║                                                                          ║
-- ║  Vem do formulário de admissão do Quark (`pessoa.email`). É o único      ║
-- ║  canal para avisar o recém-contratado do endereço corporativo e da       ║
-- ║  senha provisória — ele ainda não tem como ler a caixa nova.             ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

alter table colaboradores add column if not exists email_pessoal text;

comment on column colaboradores.email_pessoal is
  'E-mail particular (Quark). Usado só para entregar as credenciais da conta corporativa.';
