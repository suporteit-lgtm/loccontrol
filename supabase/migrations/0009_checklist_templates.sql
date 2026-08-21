-- Template editável do checklist de offboarding (Configurações → Editar template).
-- Ao desligar um colaborador, o checklist é gerado a partir destas linhas.

create table checklist_templates (
  id uuid primary key default gen_random_uuid(),
  lista text not null check (lista in ('rh','ti')),
  ordem int not null default 0,
  titulo text not null
);

alter table checklist_templates enable row level security;
create policy sel_cl_tpl on checklist_templates for select using (papel_atual() <> '');
create policy mut_cl_tpl on checklist_templates for all
  using (eh_admin()) with check (eh_admin());

-- itens atuais (mesmo conteúdo do protótipo)
insert into checklist_templates (lista, ordem, titulo) values
  ('rh', 1, 'Calcular e registrar rescisão'),
  ('rh', 2, 'Agendar exame demissional'),
  ('rh', 3, 'Comunicar equipe e gestor'),
  ('rh', 4, 'Arquivar documentos assinados'),
  ('ti', 1, 'Dar baixa nos equipamentos listados no termo'),
  ('ti', 2, 'Recolher notebook'),
  ('ti', 3, 'Recolher celular corporativo'),
  ('ti', 4, 'Remover dos grupos de e-mail'),
  ('ti', 5, 'Desativar acessos (VPN, ERP, BI)'),
  ('ti', 6, 'Arquivar caixa de e-mail');
