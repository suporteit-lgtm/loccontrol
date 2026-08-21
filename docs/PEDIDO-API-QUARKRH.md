# Solicitação de acesso à API do QuarkRH — Grupo LOC

> **Como usar este documento:** encaminhe para a pessoa responsável pelo QuarkRH
> (suporte do fornecedor ou administrador interno). Ela deve responder os itens
> do checklist abaixo. Quando todos estiverem respondidos, a integração é
> concluída em minutos.

## Contexto (para quem vai atender)

O Grupo LOC está implantando o **LOCCONTROL**, sistema interno de ciclo de vida
de colaboradores (RH + TI). No fluxo de **pré-admissão**, o RH digita o CPF ou a
matrícula do futuro colaborador e o sistema precisa buscar automaticamente os
dados dele no QuarkRH, em vez de digitação manual.

**A necessidade é somente de LEITURA, de um único tipo de dado**: consultar um
funcionário/pré-admissão pelo CPF ou matrícula. Nada será escrito no QuarkRH.

## Checklist — o que precisamos receber

### 1. Endereço da API
- [ ] URL base do ambiente de **produção** (ex.: `https://api.quarkrh.com.br`)
- [ ] URL do ambiente de **homologação/testes**, se existir

### 2. Autenticação
- [ ] Método de autenticação (API key? Token Bearer? OAuth2? Usuário de integração?)
- [ ] **Uma credencial criada para o LOCCONTROL** (não reutilizar credencial de pessoa)
- [ ] Instrução de como renovar/revogar essa credencial

### 3. O endpoint de consulta
- [ ] Método e caminho do endpoint que retorna um funcionário por **CPF**
      (ex.: `GET /v1/funcionarios?cpf=00000000000`)
- [ ] Se houver, o equivalente por **matrícula**
- [ ] Documentação dos campos retornados. Os que utilizamos são:
      | Campo | Obrigatório |
      |---|---|
      | Nome completo | sim |
      | CPF | sim |
      | Data de admissão | sim |
      | Cargo | sim |
      | Departamento / centro de custo | sim |
      | E-mail pessoal | não (bem-vindo) |
      | Telefone | não (bem-vindo) |

### 4. Exemplo funcionando (o item mais importante)
- [ ] Um exemplo **completo e real** de requisição e resposta, com um
      funcionário de teste, no formato:
      ```
      curl -H "Authorization: Bearer SEU_TOKEN" \
        "https://api.quarkrh.com.br/v1/funcionarios?cpf=12345678900"
      ```
      e o JSON de resposta correspondente.
      *Se este curl funcionar na nossa máquina, a integração está garantida.*

### 5. Restrições operacionais
- [ ] Existe limite de requisições (rate limit)? Qual?
- [ ] A API restringe acesso por IP? Se sim, qual o procedimento para
      cadastrar o IP do nosso servidor?
- [ ] Contato técnico para dúvidas durante a integração (nome + e-mail)

## Critério de conclusão

A entrega está completa quando conseguirmos executar o exemplo do item 4 e
receber os dados do funcionário de teste. Nada mais é necessário do lado do
QuarkRH.

*Dúvidas: responder a este e-mail ou contatar a TI do Grupo LOC
(suporte.it@locgrupo.com.br).*
