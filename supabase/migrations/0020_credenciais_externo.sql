-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  0020 — Credenciais para conta criada fora do Workspace                  ║
-- ║                                                                          ║
-- ║  Quando a TI marca "o e-mail já foi criado em outro lugar", as           ║
-- ║  credenciais saem por ESTE modelo: mesmo endereço e senha, o que muda    ║
-- ║  é a forma de entrar (webmail em vez do Gmail).                          ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

insert into modelos_email (chave, assunto, corpo) values (
  'credenciais-externo',
  'Sua conta de e-mail do Grupo LOC',
  'Olá, {primeiro_nome}!

Sua conta de e-mail corporativo do Grupo LOC foi criada.

Endereço: {email}
Senha provisória: {senha}

Acesse pelo link abaixo e entre com o endereço e a senha acima:
🔗 https://br.brasil113-3085.com.br:2096

Recomendamos trocar a senha no primeiro acesso.

Equipe de TI · Grupo LOC'
) on conflict (chave) do nothing;
