-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  0023 — Central de ajuda: vídeos por guia                                ║
-- ║                                                                          ║
-- ║  Cada guia da tela /ajuda tem o passo a passo escrito no código e um     ║
-- ║  slot de vídeo opcional: um admin cola o link (YouTube ou Drive) na      ║
-- ║  própria tela e o player aparece para todo mundo.                        ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

create table ajuda_videos (
  chave text primary key,          -- ex.: 'rh-pre-admissao'
  url text not null,
  atualizado_em timestamptz not null default now(),
  atualizado_por text
);

alter table ajuda_videos enable row level security;
create policy sel_ajuda_videos on ajuda_videos for select using (papel_atual() <> '');
create policy mut_ajuda_videos on ajuda_videos for all
  using (eh_admin()) with check (eh_admin());

comment on table ajuda_videos is
  'Links de vídeo dos guias da Central de ajuda (/ajuda). Sem linha = guia só com o passo a passo escrito.';
