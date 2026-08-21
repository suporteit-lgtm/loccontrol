-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  0021 — Notificação direcionada                                          ║
-- ║                                                                          ║
-- ║  destinatario (e-mail) preenchido = a notificação do NAVEGADOR só chega  ║
-- ║  para essa pessoa (o analista atribuído, o RH que abriu o chamado).      ║
-- ║  O e-mail continua seguindo a regra ampla por time — decisão do Kaique.  ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

alter table notificacoes add column if not exists destinatario text;
