-- Login por e-mail e senha (substitui o PIN + seletor de papel).
-- O hash usa scrypt (Node built-in), formato "scrypt:salt:hash".
-- Quem ainda não tem senha definida não consegue entrar — um admin define
-- na tela de Usuários. O SSO Google continua no roadmap; quando entrar,
-- a senha vira opcional.

alter table usuarios add column senha_hash text;

comment on column usuarios.senha_hash is
  'scrypt:salt:hash — nulo = usuário ainda sem senha (não consegue entrar)';
