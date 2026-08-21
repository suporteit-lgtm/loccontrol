# LOCCONTROL — estado do projeto (handoff)

> Documento de retomada. Se a conversa mudar de sessão/ferramenta, leia este
> arquivo primeiro: ele resume onde o projeto está, o que já funciona, o que
> falta e as armadilhas que já custaram tempo.
> Última atualização: 12/08/2026.

## Em uma frase

Sistema de ciclo de vida de colaboradores (RH + TI) do Grupo LOC, **no ar em
produção** em https://loccontrol.vercel.app, com Google Workspace, QuarkRH e o
sistema de chamados interno **integrados de verdade**.

## Stack e acessos

| Item | Onde |
|---|---|
| Código | `loccontrol/` (Next.js 15 + TypeScript) |
| Banco | Supabase `ygomwyrrryewfhlpfnvk` (região sa-east-1) |
| Hospedagem | Vercel, projeto `locagora-ti/loccontrol`, região **gru1** |
| Segredos | `loccontrol/.env` (local) e envs de produção na Vercel |
| Login | e-mail + senha (senha inicial padrão — confirmar com a TI) |

Publicar uma alteração:
```bash
cd loccontrol && npx vercel deploy --prod --yes --token <TOKEN_VERCEL>
```

## Integrações — todas ativas

1. **Google Workspace** (Admin SDK): cria contas, aplica grupos, bloqueio de
   emergência, exclusão de conta e backup do Drive no desligamento. Service
   account impersonando `suporte.it@locgrupo.com.br`. Escopos autorizados:
   directory (user/group/member/security), drive, `admin.datatransfer`.
   Escopo `gmail.send` **autorizado em 14/08/2026** — notificações por e-mail
   e boas-vindas saem de verdade (testado ponta a ponta).
2. **QuarkRH** (API Extrator, só leitura): busca de pré-admissão por CPF ou
   nome. A API **não tem busca por CPF** e **recusa chamadas concorrentes
   (429)** — por isso o serviço carrega o quadro inteiro (~418 pessoas, ~3s),
   cacheia 10 min e filtra localmente.
3. **Sistema de chamados interno**: espelha admissões, desligamentos e
   solicitações; webhook de volta assinado com HMAC. Validado nos dois sentidos.

## O que está pendente

- [ ] Criar o grupo **`amazonas@locgrupo.com.br`** no Workspace (mapeado, mas não existe)
- [ ] Dizer a qual unidade pertence o grupo **`zonasul@locgrupo.com.br`**
- [ ] Definir grupo de e-mail de 4 unidades: Copacabana, Freguesia, Loccel-BH, Loccel-SP
- [ ] Preencher unidade/cargo/CPF dos **492 colaboradores** importados do Workspace
      (tela Colaboradores → chip "Sem unidade")
- [ ] Trocar a senha inicial dos usuários que ainda não trocaram
- [ ] **SSO Google** (roadmap) — hoje o login é por e-mail e senha

## Armadilhas já descobertas (não repetir)

1. **Fonte não aplica**: o `className` do `next/font` precisa ficar no `<html>`,
   não no `<body>` — os tokens `--font-heading/body` são declarados em `:root`
   e a substituição de `var()` acontece onde o token foi declarado.
2. **`upsert` do supabase-js** valida NOT NULL antes do ON CONFLICT: atualizar
   por id com payload parcial falha. Use UPDATE de verdade.
3. **Datas**: Postgres devolve `+00:00`, Google devolve `.000Z` — comparar como
   string gera falso-positivo. Compare com `new Date().getTime()`.
4. **Região da Vercel**: com o app fora de `gru1`, cada consulta ao Supabase
   atravessa o continente (páginas passam de 0,6s para 1,8s).
5. **Migrations por SQL direto** não recebem os grants dos papéis da API do
   Supabase — ver migration `0005_grants.sql`.
6. **`npm run build` com o dev server aberto** corrompe `.next`. Pare antes.
7. **QuarkRH em paralelo → 429.** Google Workspace aceita paralelismo (blocos de 10).

## Documentos do projeto

| Arquivo | Conteúdo |
|---|---|
| `README.md` | setup do zero (Supabase, .env, migrations) |
| `INTEGRACOES.md` | passo a passo de cada integração |
| `docs/ESPEC-API-CHAMADOS.md` | contrato da API de chamados |
| `docs/PROMPT-API-CHAMADOS-CLAUDE.md` | briefing entregue à equipe web |
| `docs/PEDIDO-API-QUARKRH.md` | pedido de acesso ao QuarkRH |
| `supabase/migrations/` | 12 migrations versionadas |
