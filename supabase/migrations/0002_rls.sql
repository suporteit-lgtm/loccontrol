-- LOCCONTROL — Row Level Security
--
-- O app acessa o banco exclusivamente pelo servidor Next.js com a chave
-- service_role (que ignora RLS) e aplica as permissões na camada de aplicação
-- (src/lib/perms.ts), porque a autenticação real (SSO Google) ainda é um stub.
--
-- Ainda assim, RLS fica LIGADO em todas as tabelas com políticas que refletem
-- os papéis — assim, quando o SSO real for plugado no Supabase Auth (com o
-- claim `papel` no JWT), o banco já protege os dados por conta própria e nada
-- fica exposto pela API anon.

-- Helper: papel do JWT (Supabase Auth futuro)
create or replace function papel_atual() returns text
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'papel',
    ''
  )
$$;

create or replace function eh_admin() returns boolean
language sql stable as $$
  select papel_atual() in ('Superadmin','Admin RH','Admin T.I')
$$;

create or replace function eh_rh() returns boolean
language sql stable as $$
  select eh_admin() or papel_atual() = 'Usuário RH'
$$;

create or replace function eh_ti() returns boolean
language sql stable as $$
  select eh_admin() or papel_atual() = 'Usuário T.I'
$$;

-- Liga RLS em tudo (anon fica sem nenhum acesso por padrão)
alter table cidades enable row level security;
alter table unidades enable row level security;
alter table cargos enable row level security;
alter table acessos enable row level security;
alter table matriz enable row level security;
alter table usuarios enable row level security;
alter table colaboradores enable row level security;
alter table documentos enable row level security;
alter table eventos enable row level security;
alter table chamados enable row level security;
alter table checklist_itens enable row level security;
alter table grupos_workspace enable row level security;
alter table grupo_membros_externos enable row level security;
alter table auditoria enable row level security;
alter table wizard_drafts enable row level security;

-- Leitura: qualquer usuário autenticado com papel válido
create policy sel_cidades on cidades for select using (papel_atual() <> '');
create policy sel_unidades on unidades for select using (papel_atual() <> '');
create policy sel_cargos on cargos for select using (papel_atual() <> '');
create policy sel_acessos on acessos for select using (papel_atual() <> '');
create policy sel_matriz on matriz for select using (papel_atual() <> '');
create policy sel_usuarios on usuarios for select using (papel_atual() <> '');
create policy sel_colabs on colaboradores for select using (papel_atual() <> '');
create policy sel_docs on documentos for select using (papel_atual() <> '');
create policy sel_eventos on eventos for select using (papel_atual() <> '');
create policy sel_chamados on chamados for select using (papel_atual() <> '');
create policy sel_checklist on checklist_itens for select using (papel_atual() <> '');
create policy sel_grupos on grupos_workspace for select using (papel_atual() <> '');
create policy sel_membros on grupo_membros_externos for select using (papel_atual() <> '');
create policy sel_auditoria on auditoria for select using (papel_atual() <> '');

-- Cidades/unidades: escrita direta só para admins (não-admins geram solicitação)
create policy mut_cidades on cidades for all using (eh_admin()) with check (eh_admin());
create policy mut_unidades on unidades for all using (eh_admin()) with check (eh_admin());

-- Matriz e cargos: RH
create policy mut_cargos on cargos for all using (eh_rh()) with check (eh_rh());
create policy mut_matriz on matriz for all using (eh_rh()) with check (eh_rh());

-- Usuários: só admins alteram papel/aprovam/removem
create policy mut_usuarios on usuarios for all using (eh_admin()) with check (eh_admin());

-- Colaboradores e derivados: RH cria/edita; TI também atua (ativação, offboarding)
create policy mut_colabs on colaboradores for all
  using (eh_rh() or eh_ti()) with check (eh_rh() or eh_ti());
create policy mut_docs on documentos for all
  using (eh_rh() or eh_ti()) with check (eh_rh() or eh_ti());
create policy mut_eventos on eventos for insert with check (eh_rh() or eh_ti());
create policy mut_chamados on chamados for all
  using (eh_rh() or eh_ti()) with check (eh_rh() or eh_ti());
create policy mut_checklist on checklist_itens for all
  using (eh_rh() or eh_ti()) with check (eh_rh() or eh_ti());

-- Grupos: exclusão direta só admin ou Usuário T.I; criação via chamado
create policy ins_grupos on grupos_workspace for insert with check (eh_ti());
create policy del_grupos on grupos_workspace for delete using (eh_admin() or papel_atual() = 'Usuário T.I');
create policy mut_membros on grupo_membros_externos for all
  using (eh_rh() or eh_ti()) with check (eh_rh() or eh_ti());

-- Auditoria: só insere (o trigger já proíbe update/delete)
create policy ins_auditoria on auditoria for insert with check (papel_atual() <> '');

-- Rascunho do wizard: cada usuário só vê o seu (claim sub = usuarios.id no futuro)
create policy own_draft on wizard_drafts for all
  using (usuario_id::text = coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', ''))
  with check (usuario_id::text = coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', ''));
