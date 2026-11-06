-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  Escala de Presença — Grupo C                                             ║
-- ║                                                                          ║
-- ║  A e B continuam se revezando na segunda e na sexta. O Grupo C tem terça  ║
-- ║  e quinta fixas; a quarta fica livre para agendamento. A regra de datas   ║
-- ║  está em src/lib/escala/calendario.ts (o C só existe para a unidade que   ║
-- ║  tiver a linha 'C' em escala_grupo). O rodízio (grupo_inicial) segue A/B. ║
-- ║  As funções SQL já tratam qualquer letra; só as checagens mudam.          ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

alter table escala_grupo drop constraint if exists escala_grupo_letra_check;
alter table escala_grupo add constraint escala_grupo_letra_check check (letra in ('A', 'B', 'C'));

alter table escala_dia drop constraint if exists escala_dia_grupo_check;
alter table escala_dia add constraint escala_dia_grupo_check check (grupo in ('A', 'B', 'C'));

-- Grupo C da unidade que já tem escala (BH · Centro). Sem grupo do Google por
-- enquanto: o e-mail pode ser preenchido depois e a sincronização passa a usá-lo.
insert into escala_grupo (unidade_id, letra)
select unidade_id, 'C' from escala_config
on conflict (unidade_id, letra) do nothing;
