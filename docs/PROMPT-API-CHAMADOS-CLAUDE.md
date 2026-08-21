# Tarefa: criar a API de integração do sistema de chamados com o LOCCONTROL

> **Instruções de uso:** cole este documento inteiro no Claude que trabalha no
> código do sistema de chamados. Ele contém tudo o que é necessário — contexto,
> contrato exato, critérios de aceite e o que devolver no final. Nenhuma
> informação adicional do LOCCONTROL é necessária.

---

## Contexto

Você vai trabalhar no **sistema de chamados interno do Grupo LOC**. Sua tarefa é
criar uma API REST para que o **LOCCONTROL** (sistema de ciclo de vida de
colaboradores — RH/TI, roda em Next.js + Supabase) abra e acompanhe chamados na
sua ferramenta automaticamente.

O LOCCONTROL gera chamados com identificador próprio no formato `CH-NNNN`
(ex.: `CH-4832`) para: **admissões**, **desligamentos** e **solicitações de
aprovação**. Ele precisa espelhá-los na sua ferramenta e manter os status
sincronizados nos dois sentidos. O lado do LOCCONTROL já está pronto e consome
exatamente o contrato abaixo — implemente-o sem alterações de forma; se algo
for inviável na sua stack, documente o desvio no final.

## Requisitos não-funcionais

1. **REST + JSON sobre HTTPS**, rotas versionadas em `/api/v1/...`
2. **Autenticação**: header `Authorization: Bearer <token>`, com um token
   **dedicado ao LOCCONTROL** (gerável e revogável, não vinculado a uma pessoa).
   Token inválido/ausente → `401` com corpo `{"erro": "nao_autorizado"}`
3. **Idempotência** pela `referencia_externa`: é chave única. Um `POST` repetido
   com a mesma `referencia_externa` **atualiza o chamado existente e responde
   200** — nunca duplica. Este é o requisito mais importante
4. **Ambiente de homologação** com token separado
5. Datas em ISO 8601 com timezone (ex.: `2026-08-24T08:00:00-03:00`)

## Endpoints a implementar

### 1) Criar chamado
```
POST /api/v1/tickets
Authorization: Bearer <token>
Content-Type: application/json

{
  "referencia_externa": "CH-4832",          // string, obrigatório, único
  "origem": "LOCCONTROL",                   // string fixa
  "tipo": "admissao",                       // "admissao" | "desligamento" | "solicitacao"
  "titulo": "Admissão de Maria Silva — Atendente de loja",
  "descricao": "Acessos: E-mail, Sistema de locação\nEquipamentos: Notebook, Monitor",
  "prazo": "2026-08-24T08:00:00-03:00",     // opcional (SLA)
  "responsavel_email": "usuario.ti@locgrupo.com.br",  // opcional
  "solicitante_email": "admin.rh@locgrupo.com.br"     // opcional
}
```
Respostas:
- `201` criado / `200` já existia e foi atualizado (idempotência):
```json
{
  "id": "12345",
  "referencia_externa": "CH-4832",
  "status": "aberto",
  "url": "https://chamados.locgrupo.com.br/t/12345"
}
```
- `400` payload inválido → `{"erro": "validacao", "detalhe": "campo X ..."}`

### 2) Atualizar / concluir chamado
```
PATCH /api/v1/tickets/{referencia_externa}
Authorization: Bearer <token>

{ "status": "concluido", "comentario": "Conta criada e grupos aplicados pelo LOCCONTROL" }
```
- Busca **pela `referencia_externa`**, não pelo id interno
- Status válidos: `aberto`, `em_andamento`, `pausado`, `concluido`, `cancelado`
- `200` com o objeto atualizado · `404` se a referência não existir

### 3) Consultar chamado
```
GET /api/v1/tickets/{referencia_externa}
```
`200` com o objeto completo (mesmo formato do POST de resposta, incluindo
`status` e `comentarios` se houver) · `404` se não existir.

### 4) Webhook de volta (sua ferramenta → LOCCONTROL)
Sempre que um chamado com `origem = "LOCCONTROL"` mudar de status **na sua
ferramenta** (alguém concluiu, pausou, cancelou), envie:

```
POST {LOCCONTROL_WEBHOOK_URL}
Content-Type: application/json
X-Assinatura: sha256=<hex do HMAC-SHA256 do corpo bruto, com o segredo compartilhado>

{
  "referencia_externa": "CH-4832",
  "status": "concluido",
  "ator": "fulano@locgrupo.com.br",
  "quando": "2026-08-20T14:32:00-03:00"
}
```

- `LOCCONTROL_WEBHOOK_URL` e o segredo do HMAC ficam em variáveis de ambiente
  da sua aplicação (os valores serão fornecidos pela TI do Grupo LOC)
- Cálculo da assinatura (Node.js de referência):
  ```js
  const crypto = require("crypto");
  const assinatura = "sha256=" + crypto.createHmac("sha256", SEGREDO).update(corpoJsonBruto).digest("hex");
  ```
- Resposta `2xx` = entregue. Em falha, **reenviar com backoff**: 1 min → 5 min
  → 30 min → desistir e registrar em log
- Não enviar webhook para mudanças feitas **pela própria API** (evita eco:
  o LOCCONTROL acabou de fazer a mudança, não precisa ser avisado dela)

## Mapeamento de status (para referência da sua UI)

| Na sua ferramenta | Significado no LOCCONTROL |
|---|---|
| `aberto` / `em_andamento` | aparece na fila da TI com contagem de SLA |
| `pausado` | alertas silenciados ("pré-concluído") |
| `concluido` / `cancelado` | sai da fila |

## Critérios de aceite (teste antes de entregar)

Execute em homologação, na ordem:

1. `POST /tickets` com `referencia_externa: "CH-TESTE-1"` → `201`, chamado
   visível na ferramenta
2. **Repetir o mesmo POST** → `200`, e na ferramenta continua **um único**
   chamado (não duplicou)
3. `PATCH /tickets/CH-TESTE-1` com `{"status":"em_andamento"}` → `200`,
   status refletido na ferramenta
4. `GET /tickets/CH-TESTE-1` → `200` com `status: "em_andamento"`
5. Concluir o chamado **manualmente pela interface** da ferramenta → o webhook
   dispara com `status: "concluido"` e assinatura HMAC válida
6. `POST` com token inválido → `401`
7. `PATCH /tickets/CH-NAO-EXISTE` → `404`
8. Derrubar temporariamente o endpoint do webhook e concluir outro chamado →
   verificar que o reenvio com backoff acontece

## Entregáveis (devolver à TI do Grupo LOC)

Ao terminar, forneça:

1. **URL base** de produção e de homologação (ex.: `https://chamados.locgrupo.com.br/api/v1`)
2. **Token Bearer** de cada ambiente
3. Confirmação de que o webhook está implementado + **onde configurar** a URL
   de destino e o segredo HMAC (a TI fornecerá os valores)
4. Resultado dos 8 critérios de aceite
5. Qualquer desvio do contrato acima, com justificativa

Com isso em mãos, a ativação no LOCCONTROL leva minutos (as variáveis
`TICKETS_BASE_URL`, `TICKETS_TOKEN` e `TICKETS_WEBHOOK_SECRET` já existem lá).
