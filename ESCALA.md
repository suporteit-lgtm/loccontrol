# Escala de Presença (módulo do LocControl)

Escala híbrida da unidade **BH · Centro** (22 lugares): segunda e sexta são dias
fixos e alternam entre os Grupos A e B a cada semana; de terça a quinta os dias são
livres para agendamento. Feriado na segunda ou na sexta leva o grupo daquele dia para a quarta.

- **Portal do colaborador:** `/escala` (login Google @locgrupo.com.br, perfil `COLABORADOR_ESCALA`).
- **RH/Admin:** seção **ESCALA** do menu (Dashboard, Calendário, Participantes, Feriados, Configurações).
- **Regras de vaga, fila e prazo:** funções SQL com advisory lock por unidade e dia (`supabase/migrations/0025`, `0028`, `0029`).
- **Separação de acesso:** RLS e grants (`0026`, `0027`). O portal só lê as próprias linhas.

## Variáveis de ambiente

| Variável | Para quê |
|---|---|
| `ESCALA_HABILITADA=1` | Feature flag global (sem ela o módulo some: menu, rotas e cron) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Login Google do portal (chave *publishable*) |
| `CRON_SECRET` | Protege `/api/escala/cron/[tarefa]` (mesmo valor guardado no Vault) |
| `NEXT_PUBLIC_APP_URL` | Links dos e-mails (ex.: `https://loccontrol.locgrupo.com.br`) |

Google e Gmail usam as mesmas credenciais do LocControl (`GOOGLE_SA_KEY` / `GOOGLE_ADMIN_IMPERSONATE`).

## Automações

O `pg_cron` do Supabase (`0030`) chama `POST /api/escala/cron/ciclo` a cada 10 min.
A cada chamada, o ciclo decide o que roda conforme os horários das Configurações:

| Tarefa | Quando |
|---|---|
| eventos (status do colaborador) | a cada ciclo + na hora em que o RH muda o status |
| expirar-ofertas | a cada ciclo |
| google | a cada 30 min, e na hora em cada mudança (só se o modo Google não for DESLIGADO) |
| materializar (90 dias) | diária, 01:00 |
| marcar-utilizadas | diária, 23:00 |
| lembretes | dia útil anterior, no horário do lembrete (padrão 17:00) |
| resumo | dia e hora do resumo (padrão segunda 08:00) |
| feriados | anual, a partir de 1º/dez 03:00 |

Para ativar o agendador, rode uma vez no SQL Editor do Supabase, depois do deploy:

```sql
select vault.create_secret('https://<domínio>/api/escala/cron/ciclo', 'escala_cron_url');
select vault.create_secret('<mesmo CRON_SECRET da Vercel>', 'escala_cron_secret');
```

Cada execução fica em `escala_log_job` e aparece em Configurações, com o botão "Rodar agora".

## Modos de envio (Configurações da Escala)

- **E-mails:**
  - DESLIGADO (padrão): só registra.
  - TESTE: só a allowlist recebe.
  - PRODUÇÃO: envio normal (só o Superadmin liga).
- **Google:** os mesmos três modos. TESTE usa a agenda de teste e os grupos `escala-teste-a@`/`b@`, só com e-mails da allowlist, e nunca toca os grupos reais `grupo.a@`/`grupo.b@`.
- **Agenda ativa:** um evento de dia inteiro por dia na agenda compartilhada, com o grupo do dia e quem reservou como convidados, criado com `sendUpdates="none"`. A sincronização faz uma reconciliação idempotente (cria, atualiza ou remove só o que difere).
- **Escopo necessário na delegação do Admin Console:** `https://www.googleapis.com/auth/calendar` (ainda não liberado).

## Testes

```bash
npm test
```

O comando acima roda os testes de regra pura. Os testes de banco precisam da variável `ESCALA_DB_TEST=1`:

- `escala.db.test.ts`: roda numa transação com ROLLBACK.
- `escala.concorrencia.test.ts`: usa 10 conexões simultâneas num schema temporário, que é apagado no fim.

## Checklist de liberação

1. [ ] Merge do PR na `main` e deploy na Vercel.
2. [ ] Na Vercel, configurar `ESCALA_HABILITADA=1`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `CRON_SECRET` e `NEXT_PUBLIC_APP_URL`.
3. [ ] No Supabase, configurar a Auth URL Configuration com `https://<domínio>/escala/**`.
4. [ ] Criar os dois segredos do Vault, `escala_cron_url` e `escala_cron_secret`. O primeiro disparo aparece no log das automações.
5. [ ] Definir a data âncora real e o grupo inicial, e incluir os participantes nos Grupos A/B (diferença máxima de 1 pessoa).
6. [ ] Cadastrar os feriados municipais de BH e os dias sem expediente.
7. [ ] Antes da liberação: rodar "Reiniciar a escala" para apagar os dados de teste.
8. [ ] Ativar e-mails em TESTE e conferir os e-mails na allowlist.
9. [ ] Liberar o escopo `calendar` no Admin Console, ligar o Google em TESTE e clicar em "Preparar ambiente de teste". Conferir se o evento aparece na agenda.
10. [ ] Marcar "Escala liberada" na unidade e passar e-mails e Google para PRODUÇÃO (Superadmin).
