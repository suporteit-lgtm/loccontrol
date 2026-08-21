-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  0017 — Ajustes de texto dos modelos (revisão do RH/TI)                  ║
-- ║  · chamados: sai a frase sobre a conta já estar ativa                    ║
-- ║  · quark: dificuldade vira contato com o RH, não chamado da TI           ║
-- ║  Só assunto/corpo — o anexo (anexo_b64) fica intacto.                    ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

update modelos_email set corpo = 'Olá, {primeiro_nome}!

Seja bem-vindo(a) ao Grupo LOC.

Para qualquer necessidade de TI — equipamento, acesso a sistema, dúvida técnica — abra um chamado no nosso sistema interno. É por lá que o time acompanha e resolve tudo.

Utilize o link abaixo:
🔗 Link do Sistema: chamados-ti.locgrupo.com.br

1. Guia de Acesso (Em anexo): Confira o PDF em anexo neste e-mail com o passo a passo para realizar o seu primeiro acesso.

Guarde este e-mail para consultar depois.

Bom trabalho!
Equipe de TI · Grupo LOC', atualizado_em = now()
where chave = 'boas-vindas';

update modelos_email set corpo = 'Olá, {primeiro_nome}!

Seu cadastro no QuarkRH está concluído. Agora falta criar a sua senha de acesso ao portal, onde ficam o seu ponto, holerite, férias e solicitações.

🔗 Portal do QuarkRH: [INFORME AQUI O ENDEREÇO DO PORTAL]

Use o seu CPF como usuário e siga a opção de primeiro acesso / criar senha.

Qualquer dificuldade entre em contato com o RH.

Equipe de RH · Grupo LOC', atualizado_em = now()
where chave = 'acesso-quark';
