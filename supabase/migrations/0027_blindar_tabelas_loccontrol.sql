-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  Blindagem das tabelas do LocControl contra a API pública                 ║
-- ║  (PRECISA DE APROVAÇÃO SEPARADA)                                          ║
-- ║                                                                          ║
-- ║  Com o login Google do portal, passam a existir contas `authenticated`.   ║
-- ║  Hoje elas já recebem vazio (as políticas exigem o claim `papel`, que     ║
-- ║  nunca existe), mas o GRANT amplo de 0005 deixa tudo a uma política        ║
-- ║  errada de distância. O app só usa service_role, então remover os grants  ║
-- ║  de anon/authenticated não muda nada no funcionamento atual.              ║
-- ║  Nenhuma tabela, coluna, dado ou política é apagado.                      ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

revoke all on
  _migrations, acessos, ajuda_videos, auditoria, cargos, chamados, checklist_itens, checklist_templates,
  cidades, colaboradores, documentos, envios_agendados, equipamentos_catalogo, eventos,
  grupo_membros_externos, grupos_workspace, matriz, modelos_email, notificacoes, sync_estado,
  unidades, usuarios, wizard_drafts
  from anon, authenticated;

-- sequências usadas por essas tabelas
do $$
declare s record;
begin
  for s in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'S' and c.relname not like 'escala\_%'
  loop
    execute format('revoke all on sequence %I from anon, authenticated', s.relname);
  end loop;
end $$;

-- SECURITY DEFINER que consumia a sequência de chamados
revoke execute on function proximo_chamado() from public, anon, authenticated;

-- Tabelas futuras não nascem mais abertas para anon/authenticated
-- (cada migration que precisar expor algo concede explicitamente, como 0026).
alter default privileges in schema public revoke select, insert, update, delete on tables from authenticated;
alter default privileges in schema public revoke usage on sequences from authenticated;
