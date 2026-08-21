# Guia de conexão das integrações

As quatro integrações pendentes vivem em `src/services/`. Cada arquivo é um stub
com a assinatura final — conectar uma API é **trocar o corpo das funções daquele
arquivo**, sem mexer no resto do sistema.

---

## Situação atual

| Integração | Status |
|---|---|
| Google Workspace (Admin SDK) | ✅ conectado — impersona `suporte.it@locgrupo.com.br` |
| QuarkRH | ✅ conectado — token do painel, `api.quark.tec.br` |
| Sistema de chamados interno | ⏳ aguardando a API (spec em `docs/ESPEC-API-CHAMADOS.md`) |
| E-mail/notificações | ⏳ stub |
| Autenticação real (SSO) | ⏳ login por papel é demonstração |

---

## 1. Google Workspace (Admin SDK — contas, grupos, sessões, senha) — ✅ CONECTADO

É a integração mais importante: ativa contas (`criarConta`), aplica grupos
(`adicionarMembro`/`removerMembros`/`criarGrupo`/`excluirGrupo`) e executa o
botão de pânico (`executarPassoPanico`).

### Passo A — Criar o projeto no Google Cloud
1. Entre em [console.cloud.google.com](https://console.cloud.google.com) **com uma conta admin do domínio locgrupo.com.br**
2. Topo da tela → seletor de projeto → **New Project** → nome `loccontrol` → Create
3. Menu ☰ → **APIs & Services → Library**. Ative (Enable) estas APIs:
   - **Admin SDK API** (obrigatória — contas, grupos, sessões)
   - **Google Drive API** (se for usar arquivos/termos no Drive)
   - **Gmail API** (opcional, se o envio de e-mail for por Gmail)

### Passo B — Criar a Service Account
1. **APIs & Services → Credentials → Create Credentials → Service account**
2. Nome: `loccontrol-workspace` → Create and continue → (sem papel de projeto) → Done
3. Clique na service account criada → aba **Keys → Add key → Create new key → JSON**
4. Baixe o arquivo JSON — **ele é a senha da integração**. Guarde fora do repositório.
5. Ainda na service account, copie o **Unique ID** (número longo, "Client ID")

### Passo C — Autorizar no Admin Console (Domain-Wide Delegation)
A service account só pode agir no domínio se um super-admin autorizar:
1. Entre em [admin.google.com](https://admin.google.com) (conta super-admin do locgrupo.com.br)
2. **Segurança → Acesso e controle de dados → Controles de API → Delegação em todo o domínio → Gerenciar**
3. **Adicionar novo** → cole o **Client ID** do passo B.5
4. Em Escopos OAuth, cole exatamente (uma linha só):
   ```
   https://www.googleapis.com/auth/admin.directory.user,https://www.googleapis.com/auth/admin.directory.group,https://www.googleapis.com/auth/admin.directory.group.member,https://www.googleapis.com/auth/admin.directory.user.security,https://www.googleapis.com/auth/drive,https://www.googleapis.com/auth/admin.datatransfer
   ```
   > O escopo `admin.datatransfer` é o do **backup do Drive no desligamento**
   > (transferência de arquivos para outro usuário). Se ele não estiver
   > autorizado, só essa função falha — o resto continua funcionando.
5. Autorizar

### Passo D — Configurar o LOCCONTROL
1. Instale a biblioteca:
   ```bash
   npm install googleapis
   ```
2. Adicione ao `.env`:
   ```
   GOOGLE_SA_KEY_JSON=./google-service-account.json   # caminho do JSON baixado
   GOOGLE_ADMIN_IMPERSONATE=suporte.it@locgrupo.com.br # admin que a SA "encarna"
   ```
   (coloque o JSON na raiz do projeto; ele já cai no .gitignore se chamar assim — confirme)
3. Em `src/services/googleWorkspace.ts`, monte o client uma vez:
   ```ts
   import { google } from "googleapis";
   import { readFileSync } from "node:fs";

   function adminClient() {
     const key = JSON.parse(readFileSync(process.env.GOOGLE_SA_KEY_JSON!, "utf8"));
     const auth = new google.auth.JWT({
       email: key.client_email,
       key: key.private_key,
       scopes: [
         "https://www.googleapis.com/auth/admin.directory.user",
         "https://www.googleapis.com/auth/admin.directory.group",
         "https://www.googleapis.com/auth/admin.directory.group.member",
         "https://www.googleapis.com/auth/admin.directory.user.security",
       ],
       subject: process.env.GOOGLE_ADMIN_IMPERSONATE, // delegação
     });
     return google.admin({ version: "directory_v1", auth });
   }
   ```
4. Troque o corpo de cada stub pelas chamadas reais:
   | Stub | Chamada do Admin SDK |
   |---|---|
   | `criarConta(email, grupos)` | `admin.users.insert({...})` + um `admin.members.insert` por grupo |
   | `adicionarMembro(grupo, email)` | `admin.members.insert({ groupKey: grupo, requestBody: { email } })` |
   | `removerMembros(grupo, emails)` | `admin.members.delete({ groupKey, memberKey })` por e-mail |
   | `criarGrupo(nome, email)` | `admin.groups.insert({ requestBody: { name: nome, email } })` |
   | `excluirGrupo(email)` | `admin.groups.delete({ groupKey: email })` |
   | `executarPassoPanico` passo `senha` | `admin.users.update({ userKey, requestBody: { password: <aleatória> } })` |
   | passo `recuperacao` | `admin.users.update({ userKey, requestBody: { recoveryEmail: "", recoveryPhone: "" } })` |
   | passo `sessoes` | `admin.users.signOut({ userKey })` |
   | `sincronizarGrupos()` | `admin.groups.list({ customer: "my_customer" })` + `members.list` e gravar no espelho |

5. Teste com um usuário de teste antes de usar em produção (o pânico troca senha de verdade!).

---

## 2. QuarkRH — ✅ CONECTADO

Implementado em `src/services/quarkrh.ts`. O token é gerado pelo próprio painel
do QuarkRH (menu **Token (API)** → *Gerar Token*) — não precisa acionar o suporte.

```
QUARKRH_BASE_URL=https://api.quark.tec.br
QUARKRH_TOKEN=<token gerado no painel>
```

### Como a API funciona (documentada em `https://api.quark.tec.br/swagger-ui/index.html`)
- Autenticação pelo header **`Auth-token`** (não é Bearer)
- A unidade vai no header **`Unidade-Id`**; `GET /v1/unidades` lista as 14 empresas do grupo
- **Não existe busca por CPF.** Só `GET /v1/colaboradores/` (todos de uma unidade,
  paginado de 100 em 100, `?page=` começando em 1) e `GET /v1/colaboradores/{id}`
- **A API recusa chamadas concorrentes com HTTP 429** — as requisições precisam ser
  sequenciais (o serviço já faz isso, com retry e espera crescente)
- O CPF vem como **número**, então zeros à esquerda somem — o serviço repõe e formata

### Estratégia adotada
Como não há busca por CPF, o serviço carrega o quadro completo (14 unidades,
~418 pessoas, **~3 segundos**), guarda em **cache por 10 minutos** e filtra
localmente por CPF ou nome. Buscas seguintes são instantâneas.

Se a busca por nome retornar mais de uma pessoa, o wizard mostra a lista para o
RH escolher (com cargo, unidade e marcação de "desligado").

### Renovar/revogar o token
No mesmo painel do QuarkRH. Ao trocar, atualize `QUARKRH_TOKEN` no `.env` e
reinicie o servidor.

---

## 3. Sistema de chamados interno

Stub: `src/services/tickets.ts` → `notificarAbertura` / `notificarConclusao`.
Hoje os chamados CH-NNNN vivem só no banco do LOCCONTROL; a integração espelha
cada abertura/conclusão na ferramenta oficial.

1. Descubra com o time da ferramenta de tickets:
   - a URL base da API e como autenticar (token? usuário de serviço?)
   - o endpoint de **criar** chamado e o de **atualizar/fechar**
2. Adicione ao `.env`:
   ```
   TICKETS_BASE_URL=https://chamados.locgrupo.com.br/api
   TICKETS_TOKEN=xxxxx
   ```
3. Troque os stubs:
   ```ts
   export async function notificarAbertura(chamadoId: string, resumo: string) {
     await fetch(`${process.env.TICKETS_BASE_URL}/tickets`, {
       method: "POST",
       headers: { Authorization: `Bearer ${process.env.TICKETS_TOKEN}`, "Content-Type": "application/json" },
       body: JSON.stringify({ referencia: chamadoId, titulo: resumo, origem: "LOCCONTROL" }),
     });
   }
   ```
4. Se a ferramenta suportar **webhooks**, crie uma rota `src/app/api/webhooks/tickets/route.ts`
   para receber mudanças de status de lá e atualizar o chamado aqui (sincronização de mão dupla).

---

## 4. E-mail / notificações (bônus)

Stub: `src/services/notificacoes.ts`. Sugestão mais simples: [Resend](https://resend.com)
(`npm install resend`, `RESEND_API_KEY` no `.env`, ~5 linhas), ou o SMTP corporativo
com `nodemailer`. Os alertas de SLA (24h/12h) podem rodar num cron do Supabase
(`pg_cron`) ou num agendador chamando uma rota da API.

---

## 5. Autenticação real (SSO Google) — quando chegar a hora

O login por papel é demonstração. Para o SSO real:
1. Supabase → Authentication → Providers → Google (usar OAuth client do mesmo projeto GCP)
2. Restringir ao domínio `locgrupo.com.br` (hd claim)
3. No primeiro login, criar o registro em `usuarios` com status `pendente` (a tela
   de Usuários já tem o fluxo de aprovação pronto)
4. As políticas de RLS em `0002_rls.sql` já esperam o claim `papel` no JWT
