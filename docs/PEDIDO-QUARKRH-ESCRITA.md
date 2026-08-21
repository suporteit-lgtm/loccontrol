# Pedido ao suporte QuarkRH — gravação de e-mail corporativo

> Mensagem pronta para enviar ao suporte do Quark. Contexto interno: hoje temos
> só a API "Extrator" (leitura). Para fechar o ciclo da admissão precisamos
> gravar o e-mail corporativo de volta no Quark — ou confirmar que não é preciso.

---

Olá!

Usamos a API Extrator (token já ativo) para integrar o Quark ao nosso sistema
interno de admissões. A leitura está funcionando bem. Agora precisamos fechar o
ciclo no sentido contrário e temos **duas perguntas objetivas**:

**1. Existe endpoint para ATUALIZAR o e-mail corporativo de um colaborador?**

No cadastro da pessoa existe o campo *e-mail corporativo*
(`pessoa.emailCorporativo` na API). Quando a nossa TI cria a conta de e-mail do
recém-admitido, queremos gravar esse endereço automaticamente no Quark — algo
como um `PUT/PATCH /v1/colaboradores/{id}`, mesmo que restrito a esse campo.

- Se existir: qual endpoint, e o nosso token atual (Extrator) tem permissão de
  escrita ou precisamos de outro tipo de token?
- Se não existir: há previsão, ou o caminho oficial é importação por planilha?

**2. O acesso do funcionário ao portal do Quark (ponto, holerite) é criado
automaticamente quando o RH cadastra a pessoa, ou precisa de alguma ação via
API/painel?**

Se for automático, nada a fazer da nossa parte — só queremos confirmar.

Dados da conta para localizar nosso ambiente:
- Empresa: Grupo LOC
- Contato técnico: suporte.it@locgrupo.com.br

Obrigado!
