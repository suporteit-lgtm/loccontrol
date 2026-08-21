-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  0019 — Histórico de chamados                                            ║
-- ║                                                                          ║
-- ║  Concluir deixava de existir: o chamado era APAGADO e a informação       ║
-- ║  morria com ele. Agora conclusão é arquivamento — a linha fica, com      ║
-- ║  resultado, quando e por quem. As filas mostram só os abertos            ║
-- ║  (concluido_em IS NULL); o histórico mostra o resto.                     ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

alter table chamados add column if not exists concluido_em timestamptz;
alter table chamados add column if not exists resultado text; -- concluido | cancelado | negado
alter table chamados add column if not exists concluido_por text;

create index if not exists chamados_historico_idx on chamados (concluido_em desc)
  where concluido_em is not null;
