# Especificação — API do sistema de chamados interno × LOCCONTROL

> Documento para quem desenvolve/mantém o sistema de chamados do Grupo LOC.
> Define o contrato mínimo para os dois sistemas conversarem. O lado do
> LOCCONTROL já está pronto para consumir exatamente o que está descrito aqui.

## Visão geral

O LOCCONTROL gera chamados de **Admissão**, **Desligamento** e **solicitações
de aprovação** com identificador próprio `CH-NNNN`. A integração espelha esses
chamados na ferramenta oficial e mantém os status sincronizados nos dois
sentidos:

```
LOCCONTROL ──(REST: criar/atualizar)──▶ Sistema de chamados
LOCCONTROL ◀──(webhook: mudou status)── Sistema de chamados
```

## Recomendações de base (o "jeito certo")

1. **REST + JSON sobre HTTPS** — simples, testável com curl, sem dependência de framework
2. **Autenticação por token Bearer** dedicado por sistema integrado (um token só do LOCCONTROL, revogável), enviado no header `Authorization: Bearer ...`
3. **Idempotência pela referência externa** — o campo `referencia_externa` (`CH-4832`) é único; se o mesmo chamado for enviado duas vezes, a API deve atualizar em vez de duplicar. Isso torna a integração à prova de retry
4. **Webhook assinado** para o caminho de volta — mais confiável e barato que o LOCCONTROL ficar consultando de tempos em tempos
5. **Versionar a rota** (`/api/v1/...`) para poder evoluir sem quebrar
6. **Ambiente de homologação** com token separado, para testar sem sujar os dados reais

## Contrato mínimo — 3 endpoints + 1 webhook

### 1. Criar chamado
```
POST /api/v1/tickets
Authorization: Bearer <token>
Content-Type: application/json

{
  "referencia_externa": "CH-4832",
  "origem": "LOCCONTROL",
  "tipo": "admissao",                     // admissao | desligamento | solicitacao
  "titulo": "Admissão de Maria Silva — Atendente de loja",
  "descricao": "Acessos: E-mail, Sistema de locação...\nEquipamentos: Notebook, Monitor...",
  "prazo": "2026-08-24T08:00:00-03:00",   // SLA (data da admissão) — opcional
  "responsavel_email": "usuario.ti@locgrupo.com.br",
  "solicitante_email": "admin.rh@locgrupo.com.br"
}

→ 201 { "id": "12345", "referencia_externa": "CH-4832", "status": "aberto", "url": "https://chamados.locgrupo.com.br/t/12345" }
→ 200 (mesmo corpo) se a referencia_externa já existia (idempotência)
```

### 2. Atualizar / concluir chamado
```
PATCH /api/v1/tickets/CH-4832        ← buscar pela referencia_externa
Authorization: Bearer <token>

{ "status": "concluido", "comentario": "Conta criada e grupos aplicados pelo LOCCONTROL" }

→ 200 { "id": "12345", "status": "concluido" }
```
Status sugeridos (mapeamento com o kanban do LOCCONTROL):
| Sistema de chamados | LOCCONTROL |
|---|---|
| `aberto` / `em_andamento` | colunas Vence hoje / 48h / Aguardando |
| `pausado` | Pré-concluído (alertas silenciados) |
| `concluido` / `cancelado` | sai da fila |

### 3. Consultar chamado (para conferência/reconciliação)
```
GET /api/v1/tickets/CH-4832
→ 200 { "id": "12345", "referencia_externa": "CH-4832", "status": "em_andamento", ... }
```

### 4. Webhook de volta (sistema de chamados → LOCCONTROL)
Quando um chamado com `origem = LOCCONTROL` mudar de status, fazer:
```
POST https://<servidor-loccontrol>/api/webhooks/tickets
X-Assinatura: sha256=<HMAC do corpo com segredo compartilhado>
Content-Type: application/json

{ "referencia_externa": "CH-4832", "status": "concluido", "ator": "fulano@locgrupo.com.br", "quando": "2026-08-20T14:32:00-03:00" }
```
- O segredo do HMAC é combinado uma vez entre os dois times (variável de ambiente dos dois lados)
- Responder 2xx = entregue; em erro, reenviar com backoff (ex.: 1min, 5min, 30min)

## O que o LOCCONTROL fará com isso

- Ao abrir chamado de admissão/desligamento → `POST /tickets`
- Ao concluir (ativação de conta / offboarding) → `PATCH concluido`
- Ao silenciar alertas → `PATCH pausado`
- Recebendo webhook `concluido` → remove o card da fila e registra na auditoria

## Variáveis de ambiente (lado LOCCONTROL)

```
TICKETS_BASE_URL=https://chamados.locgrupo.com.br/api/v1
TICKETS_TOKEN=<token dedicado ao LOCCONTROL>
TICKETS_WEBHOOK_SECRET=<segredo do HMAC>
```

## Plano de teste (meia hora, em homologação)

1. `POST /tickets` com `CH-TESTE-1` → verificar que apareceu na ferramenta
2. Repetir o mesmo POST → verificar que **não duplicou**
3. `PATCH concluido` → verificar status na ferramenta
4. Concluir um chamado manualmente na ferramenta → verificar que o webhook chegou no LOCCONTROL
5. Token inválido → deve responder 401

## Alternativa mínima (se não houver tempo de desenvolver agora)

Se a ferramenta ainda não tiver API, dá para começar só com o **item 1**
(criar chamado) — até por e-mail estruturado — e evoluir depois. O contrato
acima continua sendo o alvo.
