-- Cada unidade tem um grupo de e-mail padrão no Workspace.
-- Na pré-admissão, os grupos sugeridos passam a ser:
--   comunicado@locgrupo.com.br  +  o grupo da unidade escolhida
-- Unidades sem grupo definido ficam com NULL e são sinalizadas na interface.

alter table unidades add column email_grupo text;

comment on column unidades.email_grupo is
  'Grupo do Workspace da unidade (ex.: centro@locgrupo.com.br). NULL = ainda não definido.';

-- Mapeamento informado pela TI, já conferido contra os grupos reais do domínio.
-- Observações:
--   · limao@ (sem acento) é o que existe no Workspace — "limão@" não existe
--   · amazonas@ ainda NÃO existe no Workspace: fica registrado para uso futuro,
--     mas a interface avisa que o grupo precisa ser criado
update unidades u set email_grupo = m.email
from (values
  ('Belo Horizonte', 'Centro',              'centro@locgrupo.com.br'),
  ('Belo Horizonte', 'Floramar',            'floramar@locgrupo.com.br'),
  ('Belo Horizonte', 'Seminovos Barreiro',  'barreiro@locgrupo.com.br'),
  ('Belo Horizonte', 'Seminovos Amazonas',  'amazonas@locgrupo.com.br'),
  ('Maceió',         'Maceió',              'maceio@locgrupo.com.br'),
  ('Salvador',       'Salvador',            'salvador@locgrupo.com.br'),
  ('Aracaju',        'Aracaju',             'aracaju@locgrupo.com.br'),
  ('Belém',          'Belém',               'belem@locgrupo.com.br'),
  ('São Paulo',      'Barueri',             'barueri@locgrupo.com.br'),
  ('São Paulo',      'Canindé',             'caninde@locgrupo.com.br'),
  ('São Paulo',      'Limão',               'limao@locgrupo.com.br'),
  ('São Paulo',      'Tatuapé',             'tatuape@locgrupo.com.br')
) as m(cidade, unidade, email)
join cidades c on c.nome = m.cidade
where u.cidade_id = c.id and u.nome = m.unidade;
