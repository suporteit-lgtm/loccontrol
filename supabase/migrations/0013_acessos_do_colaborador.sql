-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  0013 — Acessos escolhidos pelo RH em cada pré-admissão                  ║
-- ║                                                                          ║
-- ║  Antes, a tela do chamado remontava a lista pela matriz do cargo, então  ║
-- ║  um acesso desmarcado pelo RH continuava aparecendo para a TI.           ║
-- ║  Agora a seleção do RH é gravada no colaborador e manda na tela da TI.   ║
-- ║                                                                          ║
-- ║  NULL = pré-admissão antiga (antes desta migration) → cai na matriz.     ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

alter table colaboradores add column if not exists acessos text[];

comment on column colaboradores.acessos is
  'Acessos aprovados pelo RH no wizard. NULL = não informado (usar a matriz do cargo).';
