-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  0022 — Notificação por unidade                                          ║
-- ║                                                                          ║
-- ║  unidade ("Cidade|Unidade") preenchida = navegador E e-mail só chegam    ║
-- ║  para quem tem essa unidade nas suas unidades de acesso.                 ║
-- ║  unidades_acesso vazio = acesso a todas as bases → recebe tudo.          ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

alter table notificacoes add column if not exists unidade text;
