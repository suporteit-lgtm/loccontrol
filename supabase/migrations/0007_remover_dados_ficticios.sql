-- Remove todos os dados fictícios de demonstração (nomes, CPFs etc.).
-- As unidades/cidades ficam — serão ajustadas manualmente pelo usuário.
-- Os grupos do Workspace ficam (estrutura), mas sem membros fictícios.

-- Colaboradores e tudo que referencia (documentos, eventos, chamados, checklist)
truncate table colaboradores cascade;

-- Trilha de auditoria de demonstração (TRUNCATE não passa pelo trigger de imutabilidade,
-- que protege apenas UPDATE/DELETE linha a linha)
truncate table auditoria;

-- Membros de grupos que não são colaboradores (nomes fictícios)
delete from grupo_membros_externos;

-- Rascunhos do wizard
delete from wizard_drafts;

-- Usuários fictícios do sistema. Ficam:
--   · suporte.it@locgrupo.com.br (superadmin permanente)
--   · kaique.santos@locgrupo.com.br (Admin T.I)
-- E entram contas genéricas por papel para o login de demonstração continuar
-- funcionando até o SSO real (renomeie/remova na tela de Usuários).
delete from usuarios where email in (
  'paula@locgrupo.com.br',
  'diego.fontes@locgrupo.com.br',
  'sofia.prado@locgrupo.com.br',
  'carlos.nunes@locgrupo.com.br',
  'camila.alves@locgrupo.com.br'
);

insert into usuarios (nome, email, papel, status) values
  ('Admin RH', 'admin.rh@locgrupo.com.br', 'Admin RH', 'aprovado'),
  ('Usuário T.I', 'usuario.ti@locgrupo.com.br', 'Usuário T.I', 'aprovado'),
  ('Usuário RH', 'usuario.rh@locgrupo.com.br', 'Usuário RH', 'aprovado');
