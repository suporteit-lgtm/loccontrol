# LOCCONTROL — Sistema de Ciclo de Vida de Colaboradores

Sistema interno do Grupo LOC (RH + TI): pré-admissão → ativo → afastado → desligado.
Implementado em **Next.js 15 + TypeScript** com **Supabase (Postgres)**, a partir do
protótipo de design em `../design_handoff_loccontrol`.

## Como rodar (primeira vez)

### 1. Criar o projeto no Supabase
1. Acesse [supabase.com](https://supabase.com) → **New project**
2. Escolha nome (ex.: `loccontrol`), defina uma **senha do banco** (guarde-a) e a região (São Paulo / `sa-east-1`)
3. Aguarde o projeto provisionar (~2 min)

### 2. Configurar o `.env`
Copie o exemplo e preencha:

```bash
copy .env.example .env
```

| Variável | Onde encontrar no painel do Supabase |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Settings → API → **Project URL** |
| `SUPABASE_SERVICE_ROLE_KEY` | Settings → API → **service_role** (secret) |
| `DATABASE_URL` | Connect (topo da página) → **URI** — troque `[YOUR-PASSWORD]` pela senha do banco |
| `SESSION_SECRET` | qualquer string longa aleatória |

### 3. Criar o banco (migrations + seeds)

```bash
npm install
npm run db:migrate
```

Isso aplica, em ordem: schema completo, políticas de RLS, seeds (colaboradores,
usuários, grupos, chamados com SLA, matriz, auditoria) e funções.

### 4. Rodar

Para **usar/testar** (rápido — recomendado):

```bash
npm run producao
```

Para **desenvolver** (recarrega ao editar código, mas compila cada tela na
primeira visita — por isso parece lento):

```bash
npm run dev
```

Abra http://localhost:3000 — a tela de login permite entrar com qualquer um dos
5 papéis (demonstração; a autenticação real por SSO Google é um stub pendente).

## Estrutura

```
supabase/migrations/   ← schema, RLS, seeds (SQL versionado)
scripts/migrate.mjs    ← aplica migrations via DATABASE_URL
src/lib/               ← sessão, permissões, formatação, auditoria, acesso a dados
src/services/          ← STUBS das integrações pendentes (claramente marcados)
src/components/        ← shell (sidebar/drawer), toasts, tema, UI compartilhada
src/app/(app)/         ← as 17 telas
src/app/actions/       ← server actions (todas as mutações + trilha de auditoria)
```

## Papéis (login de demonstração)

| Papel | Usuário seed | Vê |
|---|---|---|
| Superadmin | suporte.it@locgrupo.com.br | tudo |
| Admin RH | Paula Mendes | tudo, aprova solicitações |
| Admin T.I | Kaique Santos | tudo, aprova solicitações |
| Usuário T.I | Diego Fontes | telas TI + gerais; exclui grupos direto |
| Usuário RH | Camila Rodrigues Alves | telas RH + gerais |

Regras de aprovação: não-admins que criam/removem cidades, unidades ou grupos
geram uma **solicitação** que cai na Fila da TI (coluna Aguardando); admins
executam direto. Papéis/remoção de usuários: somente admins.

## Integrações pendentes (stubs em `src/services/`)

- **Google Workspace Admin SDK** (`googleWorkspace.ts`) — contas, grupos, sessões, senha (área restrita)
- **QuarkRH** (`quarkrh.ts`) — importação de pré-admissão no passo 1 do wizard
- **Sistema de chamados interno** (`tickets.ts`) — espelhamento dos CH-NNNN
- **E-mail/notificações** (`notificacoes.ts`) — alertas de SLA e eventos
- **Autenticação real** — SSO Google do domínio; o seletor de papel do login é demo.
  As políticas de RLS já estão escritas para o claim `papel` no JWT (ver `0002_rls.sql`).

Cada stub mantém a assinatura final — para integrar, basta trocar o corpo da função.

## Notas de implementação

- A coluna do kanban da Fila da TI é **derivada do SLA** (hoje / 48h / aguardando),
  com "pré-concluído" manual (silenciar alertas, com Desfazer no toast).
- Toda mutação relevante grava no **log de auditoria** (tabela imutável por trigger).
- O rascunho do wizard persiste **no banco por usuário** (`wizard_drafts`) — sobrevive
  a navegação e troca de máquina.
- Tema claro/escuro persistido em `localStorage['ciclo-tema']`; filtro "Minha unidade"
  em cookie; menu colapsável em `localStorage`.
- A falha parcial de sincronização de grupo após ativar um colaborador é um **mock**
  (exercita o fluxo de retry do protótipo) — remover quando a Groups API real entrar.
