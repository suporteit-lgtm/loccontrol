-- LOCCONTROL — Seeds derivados dos dados de exemplo do protótipo

-- ── Cidades e unidades ────────────────────────────────────────────────────────
insert into cidades (id, nome) values
  ('11111111-0000-0000-0000-000000000001', 'Belo Horizonte'),
  ('11111111-0000-0000-0000-000000000002', 'Belém'),
  ('11111111-0000-0000-0000-000000000003', 'Rio de Janeiro'),
  ('11111111-0000-0000-0000-000000000004', 'São Paulo');

insert into unidades (cidade_id, nome) values
  ('11111111-0000-0000-0000-000000000001', 'Centro'),
  ('11111111-0000-0000-0000-000000000001', 'Floramar'),
  ('11111111-0000-0000-0000-000000000001', 'Savassi'),
  ('11111111-0000-0000-0000-000000000002', 'Nazaré'),
  ('11111111-0000-0000-0000-000000000002', 'Umarizal'),
  ('11111111-0000-0000-0000-000000000003', 'Campo Grande'),
  ('11111111-0000-0000-0000-000000000003', 'Centro · Matriz'),
  ('11111111-0000-0000-0000-000000000003', 'Duque de Caxias'),
  ('11111111-0000-0000-0000-000000000003', 'Niterói'),
  ('11111111-0000-0000-0000-000000000004', 'Itaim Bibi'),
  ('11111111-0000-0000-0000-000000000004', 'Pinheiros');

-- ── Acessos e cargos ──────────────────────────────────────────────────────────
insert into acessos (nome, ordem) values
  ('E-mail corporativo', 1), ('Sistema de locação', 2), ('ERP Protheus', 3),
  ('Portal QuarkRH', 4), ('Drive compartilhado', 5), ('WhatsApp Business', 6),
  ('BI Metabase', 7), ('VPN', 8);

insert into cargos (nome) values
  ('Analista de RH'), ('Analista financeiro'), ('Atendente de loja'),
  ('Coordenador de operações'), ('Gerente de unidade'), ('Mecânico de motos'),
  ('Suporte de TI'), ('Vendedor');

-- Matriz cargo × acesso (base do protótipo)
-- obrigatório: E-mail corporativo sempre; Sistema de locação para Atendente/Vendedor/Mecânico
with base(cargo, acesso) as (
  values
    ('Analista de RH', 'E-mail corporativo'), ('Analista de RH', 'Portal QuarkRH'), ('Analista de RH', 'Drive compartilhado'),
    ('Analista financeiro', 'E-mail corporativo'), ('Analista financeiro', 'ERP Protheus'), ('Analista financeiro', 'BI Metabase'), ('Analista financeiro', 'Drive compartilhado'),
    ('Atendente de loja', 'E-mail corporativo'), ('Atendente de loja', 'Sistema de locação'), ('Atendente de loja', 'WhatsApp Business'),
    ('Coordenador de operações', 'E-mail corporativo'), ('Coordenador de operações', 'Sistema de locação'), ('Coordenador de operações', 'ERP Protheus'), ('Coordenador de operações', 'BI Metabase'), ('Coordenador de operações', 'Drive compartilhado'), ('Coordenador de operações', 'VPN'),
    ('Gerente de unidade', 'E-mail corporativo'), ('Gerente de unidade', 'Sistema de locação'), ('Gerente de unidade', 'ERP Protheus'), ('Gerente de unidade', 'BI Metabase'), ('Gerente de unidade', 'Drive compartilhado'), ('Gerente de unidade', 'WhatsApp Business'), ('Gerente de unidade', 'VPN'),
    ('Mecânico de motos', 'E-mail corporativo'), ('Mecânico de motos', 'Sistema de locação'),
    ('Suporte de TI', 'E-mail corporativo'), ('Suporte de TI', 'VPN'), ('Suporte de TI', 'ERP Protheus'), ('Suporte de TI', 'Drive compartilhado'), ('Suporte de TI', 'BI Metabase'),
    ('Vendedor', 'E-mail corporativo'), ('Vendedor', 'Sistema de locação'), ('Vendedor', 'WhatsApp Business')
)
insert into matriz (cargo_id, acesso_id, ligado, obrigatorio)
select c.id, a.id,
  exists (select 1 from base b where b.cargo = c.nome and b.acesso = a.nome),
  (a.nome = 'E-mail corporativo')
    or (a.nome = 'Sistema de locação' and c.nome in ('Atendente de loja', 'Vendedor', 'Mecânico de motos'))
from cargos c cross join acessos a;

-- ── Usuários do sistema ───────────────────────────────────────────────────────
insert into usuarios (id, nome, email, papel, status, superadmin, ultimo_acesso, solicitado_em) values
  ('22222222-0000-0000-0000-000000000000', 'Suporte TI', 'suporte.it@locgrupo.com.br', 'Superadmin', 'aprovado', true, '2026-08-09 08:00', null),
  ('22222222-0000-0000-0000-000000000001', 'Kaique Santos', 'kaique.santos@locgrupo.com.br', 'Admin T.I', 'aprovado', false, '2026-08-08 21:14', null),
  ('22222222-0000-0000-0000-000000000002', 'Paula Mendes', 'paula@locgrupo.com.br', 'Admin RH', 'aprovado', false, '2026-08-08 18:02', null),
  ('22222222-0000-0000-0000-000000000003', 'Diego Fontes', 'diego.fontes@locgrupo.com.br', 'Usuário T.I', 'aprovado', false, '2026-08-08 17:31', null),
  ('22222222-0000-0000-0000-000000000004', 'Sofia Prado', 'sofia.prado@locgrupo.com.br', 'Usuário T.I', 'aprovado', false, '2026-08-07 16:44', null),
  ('22222222-0000-0000-0000-000000000005', 'Carlos Eduardo Nunes', 'carlos.nunes@locgrupo.com.br', 'Usuário T.I', 'pendente', false, null, '2026-08-08 09:31'),
  ('22222222-0000-0000-0000-000000000006', 'Camila Rodrigues Alves', 'camila.alves@locgrupo.com.br', 'Usuário RH', 'aprovado', false, '2026-08-08 15:20', null);

-- ── Grupos do Workspace ───────────────────────────────────────────────────────
insert into grupos_workspace (nome, email) values
  ('Geral', 'geral@locgrupo.com.br'),
  ('Unidade BH', 'bh@locgrupo.com.br'),
  ('Unidade Belém', 'belem@locgrupo.com.br'),
  ('Unidade RJ', 'rj@locgrupo.com.br'),
  ('Unidade SP', 'sp@locgrupo.com.br'),
  ('Engenharia', 'eng@locgrupo.com.br'),
  ('Time de dados', 'time-dados@locgrupo.com.br'),
  ('Operações', 'operacoes@locgrupo.com.br'),
  ('Financeiro', 'financeiro@locgrupo.com.br'),
  ('Liderança', 'lideranca@locgrupo.com.br');

insert into grupo_membros_externos (grupo_email, nome, email) values
  ('geral@locgrupo.com.br', 'Diego Fontes', 'diego.fontes@locgrupo.com.br'),
  ('geral@locgrupo.com.br', 'Kaique Santos', 'kaique.santos@locgrupo.com.br'),
  ('geral@locgrupo.com.br', 'Paula Mendes', 'paula@locgrupo.com.br'),
  ('geral@locgrupo.com.br', 'Rafael Costa', 'rafael.costa@locgrupo.com.br'),
  ('geral@locgrupo.com.br', 'Sofia Prado', 'sofia.prado@locgrupo.com.br'),
  ('eng@locgrupo.com.br', 'Rafael Costa', 'rafael.costa@locgrupo.com.br'),
  ('eng@locgrupo.com.br', 'Sofia Prado', 'sofia.prado@locgrupo.com.br'),
  ('time-dados@locgrupo.com.br', 'Kaique Santos', 'kaique.santos@locgrupo.com.br'),
  ('operacoes@locgrupo.com.br', 'Diego Fontes', 'diego.fontes@locgrupo.com.br'),
  ('financeiro@locgrupo.com.br', 'Paula Mendes', 'paula@locgrupo.com.br'),
  ('lideranca@locgrupo.com.br', 'Kaique Santos', 'kaique.santos@locgrupo.com.br'),
  ('lideranca@locgrupo.com.br', 'Paula Mendes', 'paula@locgrupo.com.br');

-- ── Colaboradores (c1–c8 do protótipo) ────────────────────────────────────────
insert into colaboradores (id, nome, cpf, cargo, dept, admissao, status, email, telefone, cidade, unidade, grupos, equipamentos, analista, obs_ti, desligamento) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Ana Beatriz Duarte', '412.887.230-05', 'Analista de RH', 'RH', '2026-08-12', 'Pré-admissão', null, '(21) 98811-4032', 'Rio de Janeiro', 'Centro · Matriz',
    '{time-dados@locgrupo.com.br,geral@locgrupo.com.br,rj@locgrupo.com.br}', '{Fone,Monitor,Mouse,Mousepad,Notebook,Teclado}', 'Diego Fontes', 'Precisa de acesso ao repositório de dados até o dia 1º.', null),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Carlos Eduardo Nunes', '318.402.577-90', 'Suporte de TI', 'TI', '2025-02-03', 'Ativo', 'carlos.nunes@locgrupo.com.br', '(21) 99720-5518', 'Rio de Janeiro', 'Centro · Matriz',
    '{eng@locgrupo.com.br,geral@locgrupo.com.br,rj@locgrupo.com.br}', '{Fone,Monitor,Mouse,Notebook,Teclado}', null, null, null),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Mariana Lopes Ferreira', '274.919.106-33', 'Coordenador de operações', 'Operações', '2023-09-15', 'Ativo', 'mariana.ferreira@locgrupo.com.br', '(21) 98104-7726', 'Rio de Janeiro', 'Niterói',
    '{operacoes@locgrupo.com.br,geral@locgrupo.com.br,lideranca@locgrupo.com.br,rj@locgrupo.com.br}', '{Celular,Chip corporativo,Monitor,Notebook}', null, null, null),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'João Pedro Sales', '507.334.812-71', 'Mecânico de motos', 'Operações', '2024-03-08', 'Afastado', 'joao.sales@locgrupo.com.br', '(22) 99815-2244', 'Rio de Janeiro', 'Duque de Caxias',
    '{operacoes@locgrupo.com.br,geral@locgrupo.com.br,rj@locgrupo.com.br}', '{Celular,Chip corporativo}', null, null, null),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'Renata Cardoso Lima', '190.556.428-04', 'Analista financeiro', 'Financeiro', '2022-05-02', 'Desligado', 'renata.lima@locgrupo.com.br', '(21) 97430-8891', 'Rio de Janeiro', 'Centro · Matriz',
    '{financeiro@locgrupo.com.br,geral@locgrupo.com.br,rj@locgrupo.com.br}', '{Celular,Chip corporativo,Monitor,Mouse,Notebook,Teclado}', 'Diego Fontes', null, '2026-06-30'),
  ('aaaaaaaa-0000-0000-0000-000000000006', 'Felipe Araújo Souza', '633.208.145-66', 'Vendedor', 'Comercial', '2026-08-09', 'Pré-admissão', null, '(21) 96650-3327', 'Rio de Janeiro', 'Campo Grande',
    '{eng@locgrupo.com.br,geral@locgrupo.com.br,rj@locgrupo.com.br}', '{Fone,Monitor,Mouse,Notebook,Teclado,Webcam}', 'Diego Fontes', null, null),
  ('aaaaaaaa-0000-0000-0000-000000000007', 'Camila Rodrigues Alves', '845.771.309-22', 'Analista financeiro', 'Financeiro', '2024-11-10', 'Ativo', 'camila.alves@locgrupo.com.br', '(21) 98240-6613', 'Rio de Janeiro', 'Niterói',
    '{financeiro@locgrupo.com.br,geral@locgrupo.com.br,rj@locgrupo.com.br}', '{Monitor,Mouse,Notebook,Teclado}', null, null, null),
  ('aaaaaaaa-0000-0000-0000-000000000008', 'Luiza Martins Rocha', '921.640.583-17', 'Atendente de loja', 'Operações', '2026-08-20', 'Pré-admissão', null, '(21) 99118-0457', 'Rio de Janeiro', 'Centro · Matriz',
    '{time-dados@locgrupo.com.br,geral@locgrupo.com.br,rj@locgrupo.com.br}', '{Fone,Monitor,Mouse,Mousepad,Notebook,Teclado}', 'Sofia Prado', null, null);

-- Demais colaboradores (multi-cidade)
insert into colaboradores (id, nome, cpf, cargo, dept, admissao, status, email, telefone, cidade, unidade, grupos, equipamentos) values
  ('aaaaaaaa-0000-0000-0000-000000000101', 'Tiago Moreira Pinto', '284.610.937-40', 'Vendedor', 'Comercial', '2024-04-14', 'Ativo', 'tiago.pinto@locgrupo.com.br', '(31) 98722-1045', 'Belo Horizonte', 'Centro', '{geral@locgrupo.com.br,bh@locgrupo.com.br}', '{Celular,Chip corporativo}'),
  ('aaaaaaaa-0000-0000-0000-000000000102', 'Larissa Gomes Teixeira', '530.176.482-09', 'Atendente de loja', 'Operações', '2025-06-02', 'Ativo', 'larissa.teixeira@locgrupo.com.br', '(31) 99310-8827', 'Belo Horizonte', 'Centro', '{operacoes@locgrupo.com.br,geral@locgrupo.com.br,bh@locgrupo.com.br}', '{Celular,Chip corporativo}'),
  ('aaaaaaaa-0000-0000-0000-000000000103', 'Bruno Carvalho Dias', '617.845.203-71', 'Mecânico de motos', 'Operações', '2023-01-19', 'Ativo', 'bruno.dias@locgrupo.com.br', '(31) 98104-5561', 'Belo Horizonte', 'Floramar', '{operacoes@locgrupo.com.br,geral@locgrupo.com.br,bh@locgrupo.com.br}', '{Celular,Chip corporativo}'),
  ('aaaaaaaa-0000-0000-0000-000000000104', 'Isabela Freitas Ramos', '905.238.614-30', 'Gerente de unidade', 'Operações', '2022-10-07', 'Ativo', 'isabela.ramos@locgrupo.com.br', '(31) 99655-2098', 'Belo Horizonte', 'Savassi', '{lideranca@locgrupo.com.br,geral@locgrupo.com.br,bh@locgrupo.com.br}', '{Monitor,Mouse,Notebook,Teclado}'),
  ('aaaaaaaa-0000-0000-0000-000000000105', 'Rodrigo Assis Barbosa', '348.921.760-15', 'Coordenador de operações', 'Operações', '2023-05-23', 'Ativo', 'rodrigo.barbosa@locgrupo.com.br', '(91) 98230-4471', 'Belém', 'Nazaré', '{operacoes@locgrupo.com.br,geral@locgrupo.com.br,belem@locgrupo.com.br}', '{Monitor,Mouse,Notebook,Teclado}'),
  ('aaaaaaaa-0000-0000-0000-000000000106', 'Vitória Castro Melo', '762.408.135-88', 'Atendente de loja', 'Operações', '2025-03-11', 'Ativo', 'vitoria.melo@locgrupo.com.br', '(91) 99518-7702', 'Belém', 'Nazaré', '{operacoes@locgrupo.com.br,geral@locgrupo.com.br,belem@locgrupo.com.br}', '{Celular,Chip corporativo}'),
  ('aaaaaaaa-0000-0000-0000-000000000107', 'Gustavo Lima Peixoto', '129.573.846-52', 'Vendedor', 'Comercial', '2024-08-28', 'Afastado', 'gustavo.peixoto@locgrupo.com.br', '(91) 98077-3316', 'Belém', 'Umarizal', '{geral@locgrupo.com.br,belem@locgrupo.com.br}', '{Celular,Chip corporativo}'),
  ('aaaaaaaa-0000-0000-0000-000000000108', 'Fernanda Ribeiro Costa', '486.017.259-63', 'Analista financeiro', 'Financeiro', '2024-02-05', 'Ativo', 'fernanda.costa@locgrupo.com.br', '(11) 97430-6690', 'São Paulo', 'Itaim Bibi', '{financeiro@locgrupo.com.br,geral@locgrupo.com.br,sp@locgrupo.com.br}', '{Monitor,Mouse,Notebook,Teclado}'),
  ('aaaaaaaa-0000-0000-0000-000000000109', 'Henrique Barros Leal', '853.694.107-24', 'Vendedor', 'Comercial', '2023-07-16', 'Ativo', 'henrique.leal@locgrupo.com.br', '(11) 98861-0253', 'São Paulo', 'Itaim Bibi', '{geral@locgrupo.com.br,sp@locgrupo.com.br}', '{Celular,Chip corporativo}'),
  ('aaaaaaaa-0000-0000-0000-000000000110', 'Juliana Prado Martins', '270.941.586-11', 'Atendente de loja', 'Operações', '2024-12-09', 'Ativo', 'juliana.martins@locgrupo.com.br', '(11) 99204-7738', 'São Paulo', 'Pinheiros', '{operacoes@locgrupo.com.br,geral@locgrupo.com.br,sp@locgrupo.com.br}', '{Celular,Chip corporativo}'),
  ('aaaaaaaa-0000-0000-0000-000000000111', 'Marcos Vinícius Teles', '694.128.350-97', 'Mecânico de motos', 'Operações', '2023-11-21', 'Ativo', 'marcos.teles@locgrupo.com.br', '(21) 98450-1129', 'Rio de Janeiro', 'Campo Grande', '{operacoes@locgrupo.com.br,geral@locgrupo.com.br,rj@locgrupo.com.br}', '{Celular,Chip corporativo}'),
  ('aaaaaaaa-0000-0000-0000-000000000112', 'Patrícia Nogueira Silva', '518.302.746-85', 'Atendente de loja', 'Operações', '2025-04-30', 'Ativo', 'patricia.silva@locgrupo.com.br', '(21) 99640-5583', 'Rio de Janeiro', 'Duque de Caxias', '{operacoes@locgrupo.com.br,geral@locgrupo.com.br,rj@locgrupo.com.br}', '{Celular,Chip corporativo}');

-- ── Documentos ────────────────────────────────────────────────────────────────
insert into documentos (colaborador_id, arquivo, assinado_em) values
  ('aaaaaaaa-0000-0000-0000-000000000002', 'contrato-carlos-nunes.pdf', '2025-02-01'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'atestado-inss-joao-sales.pdf', '2026-07-14'),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'termo-equipamentos-renata-lima.pdf', '2026-06-28');

-- ── Eventos por fase ──────────────────────────────────────────────────────────
insert into eventos (colaborador_id, fase, quando, ator, descricao) values
  -- Ana Beatriz (c1)
  ('aaaaaaaa-0000-0000-0000-000000000001', 'pre', '2026-08-05 09:12', 'Paula Mendes · RH', 'Pré-admissão importada do QuarkRH'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'pre', '2026-08-05 09:14', 'Sistema', 'Chamado CH-4821 aberto para Diego Fontes'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'pre', '2026-08-06 16:40', 'Diego Fontes · TI', 'Acessos VPN e BI Metabase concedidos'),
  -- Carlos (c2)
  ('aaaaaaaa-0000-0000-0000-000000000002', 'pre', '2025-01-20 10:02', 'Paula Mendes · RH', 'Pré-admissão criada'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'pre', '2025-02-02 15:30', 'Diego Fontes · TI', 'Conta criada e grupos aplicados'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'ativo', '2025-02-03 08:00', 'Sistema', 'Status alterado para Ativo'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'ativo', '2026-07-22 11:05', 'Sofia Prado · TI', 'Incluído no grupo eng@'),
  -- Mariana (c3)
  ('aaaaaaaa-0000-0000-0000-000000000003', 'ativo', '2023-09-15 08:00', 'Sistema', 'Status alterado para Ativo'),
  -- João Pedro (c4)
  ('aaaaaaaa-0000-0000-0000-000000000004', 'ativo', '2024-03-08 08:00', 'Sistema', 'Status alterado para Ativo'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'afastado', '2026-07-14 08:30', 'Paula Mendes · RH', 'Afastamento INSS registrado'),
  -- Renata (c5)
  ('aaaaaaaa-0000-0000-0000-000000000005', 'ativo', '2022-05-02 08:00', 'Sistema', 'Status alterado para Ativo'),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'desligado', '2026-06-30 17:02', 'Paula Mendes · RH', 'Desligamento registrado · checklist gerado'),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'desligado', '2026-07-01 09:15', 'Diego Fontes · TI', 'Acesso VPN revogado'),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'desligado', '2026-07-01 14:20', 'Diego Fontes · TI', 'Notebook recolhido'),
  -- Felipe (c6)
  ('aaaaaaaa-0000-0000-0000-000000000006', 'pre', '2026-08-01 11:20', 'Paula Mendes · RH', 'Pré-admissão importada do QuarkRH'),
  ('aaaaaaaa-0000-0000-0000-000000000006', 'pre', '2026-08-01 11:22', 'Sistema', 'Chamado CH-4818 aberto para Diego Fontes'),
  -- Camila (c7)
  ('aaaaaaaa-0000-0000-0000-000000000007', 'ativo', '2024-11-10 08:00', 'Sistema', 'Status alterado para Ativo'),
  -- Luiza (c8)
  ('aaaaaaaa-0000-0000-0000-000000000008', 'pre', '2026-08-04 14:05', 'Paula Mendes · RH', 'Pré-admissão importada do QuarkRH'),
  ('aaaaaaaa-0000-0000-0000-000000000008', 'pre', '2026-08-04 14:06', 'Sistema', 'Chamado CH-4825 aberto para Sofia Prado'),
  ('aaaaaaaa-0000-0000-0000-000000000008', 'pre', '2026-08-04 15:11', 'Sofia Prado · TI', 'Alertas silenciados (pré-concluído)'),
  -- Gustavo (afastado)
  ('aaaaaaaa-0000-0000-0000-000000000107', 'afastado', '2026-07-18 09:00', 'Paula Mendes · RH', 'Afastamento registrado');

-- Evento "Ativo" genérico para os demais colaboradores ativos
insert into eventos (colaborador_id, fase, quando, ator, descricao)
select id, 'ativo', admissao::timestamptz + interval '8 hours', 'Sistema', 'Status alterado para Ativo'
from colaboradores
where id::text like 'aaaaaaaa-0000-0000-0000-0000000001%' and status in ('Ativo', 'Afastado');

-- ── Chamados (fila da TI) ─────────────────────────────────────────────────────
-- SLAs relativos ao momento do seed, como no protótipo (18h, 41h, 13 dias)
insert into chamados (id, colaborador_id, tipo, silenciado, sla_alvo, analista) values
  ('CH-4821', 'aaaaaaaa-0000-0000-0000-000000000001', 'Admissão', false, now() + interval '18 hours 24 minutes', 'Diego Fontes'),
  ('CH-4818', 'aaaaaaaa-0000-0000-0000-000000000006', 'Admissão', false, now() + interval '41 hours 10 minutes', 'Diego Fontes'),
  ('CH-4790', 'aaaaaaaa-0000-0000-0000-000000000005', 'Desligamento', false, null, 'Diego Fontes'),
  ('CH-4825', 'aaaaaaaa-0000-0000-0000-000000000008', 'Admissão', true, now() + interval '13 days', 'Sofia Prado');

-- ── Checklist de offboarding da Renata (c5) ───────────────────────────────────
insert into checklist_itens (colaborador_id, lista, ordem, titulo, done, por, quando, obs) values
  ('aaaaaaaa-0000-0000-0000-000000000005', 'rh', 1, 'Calcular e registrar rescisão', true, 'Paula Mendes', '2026-07-01 10:12', null),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'rh', 2, 'Agendar exame demissional', true, 'Paula Mendes', '2026-07-01 10:40', 'Clínica Vida, 04/07 às 9h'),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'rh', 3, 'Comunicar equipe e gestor', false, null, null, null),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'rh', 4, 'Arquivar documentos assinados', false, null, null, null),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'ti', 1, 'Dar baixa nos equipamentos listados no termo', false, null, null, null),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'ti', 2, 'Recolher notebook', true, 'Diego Fontes', '2026-07-01 14:20', null),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'ti', 3, 'Recolher celular corporativo', false, null, null, null),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'ti', 4, 'Remover dos grupos de e-mail', false, null, null, null),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'ti', 5, 'Desativar acessos (VPN, ERP, BI)', false, null, null, null),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'ti', 6, 'Arquivar caixa de e-mail', false, null, null, null);

-- ── Auditoria inicial ─────────────────────────────────────────────────────────
insert into auditoria (pessoa, ator, quando, tabela, campo, antes, depois) values
  ('Ana Beatriz Duarte', 'Diego Fontes', '2026-08-06 16:40', 'acessos', 'bi_metabase', 'pendente', 'concedido'),
  ('Ana Beatriz Duarte', 'Paula Mendes', '2026-08-05 09:12', 'colaboradores', 'registro', '—', 'criado'),
  ('Luiza Martins Rocha', 'Sofia Prado', '2026-08-04 15:11', 'chamados', 'alertas', 'ativos', 'silenciados'),
  ('Carlos Eduardo Nunes', 'Sofia Prado', '2026-07-22 11:05', 'grupos', 'eng@locgrupo.com.br', '—', 'incluído'),
  ('João Pedro Sales', 'Paula Mendes', '2026-07-14 08:30', 'colaboradores', 'status', 'Ativo', 'Afastado'),
  ('Renata Cardoso Lima', 'Diego Fontes', '2026-07-01 09:15', 'acessos', 'vpn', 'concedido', 'revogado'),
  ('Renata Cardoso Lima', 'Paula Mendes', '2026-06-30 17:02', 'colaboradores', 'status', 'Ativo', 'Desligado');
