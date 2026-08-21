-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  0018 — Boas-vindas SÓ para quem o RH ativar daqui pra frente            ║
-- ║                                                                          ║
-- ║  O agendamento pós-login considerava toda a base Ativa com login — e     ║
-- ║  disparou para 115 pessoas importadas do Workspace (17/08). Agora só     ║
-- ║  entra na fila quem tiver esta marca, gravada exclusivamente pela        ║
-- ║  ativação do RH (ativarNaEmpresa). Base importada nunca ganha a marca.   ║
-- ║                                                                          ║
-- ║  + Chamado concluído pelo sistema de chamados externo: some da fila da   ║
-- ║    TI mas continua na do RH — `ti_concluido` marca esse estado.          ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

alter table colaboradores add column if not exists aguarda_boas_vindas boolean not null default false;

comment on column colaboradores.aguarda_boas_vindas is
  'true = ativado pelo RH e ainda sem os e-mails pós-login. Só ativarNaEmpresa liga; o agendamento desliga.';

alter table chamados add column if not exists ti_concluido boolean not null default false;

comment on column chamados.ti_concluido is
  'true = concluído no sistema de chamados externo: sai da fila da TI, permanece na do RH.';
