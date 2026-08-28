# LOCCONTROL — roteiro de apresentação

> Para apresentar o sistema ao CTO e à equipe de RH. Ordem pensada para contar
> uma história: o problema → o fluxo de admissão de ponta a ponta → o
> desligamento → governança. ~20 minutos.

## A frase de abertura

**"Hoje, admitir ou desligar alguém envolvia WhatsApp, e-mail, planilha e
memória. O LOCCONTROL coloca tudo isso numa esteira só — com prazo, rastro e
automação no que era braçal."**

## 1. O problema que ele resolve (2 min)

- Admissão dependia de avisos manuais entre RH e TI — e do que alguém lembrava
- Ninguém sabia "em que pé está o processo do fulano" sem perguntar
- Criar conta, aplicar grupos de e-mail, avisar o colaborador: tudo à mão
- Sem histórico: concluiu, perdeu a informação

## 2. Demonstração — admissão de ponta a ponta (8 min)

Use o botão **"？ Como funciona"** (presente no Dashboard e nas filas) — ele
mostra o fluxo em 4 passos e é ótimo slide ao vivo.

1. **Dashboard (RH)** — números da unidade, gráfico de admissões, próximas
   chegadas com prazo. Trocar a unidade no menu lateral muda tudo.
2. **Nova pré-admissão** — buscar uma pessoa real pelo CPF: os dados vêm do
   **QuarkRH** sem redigitar. Escolher cargo → os acessos do cargo vêm da
   **Matriz**; grupo de e-mail da unidade entra sozinho; marcar equipamentos.
   Ao concluir: chamado aberto para a TI **com prazo pela data de admissão** e
   espelhado no sistema de chamados, já atribuído ao analista.
3. **Fila da TI** — colunas por urgência (vence hoje / 48h / aguardando). Abrir
   o chamado: informar o e-mail (sugestão `nome.sobrenome@` automática), o
   sistema **cria a conta no Google Workspace de verdade** e aplica os grupos.
   As credenciais vão sozinhas para o e-mail pessoal do contratado.
4. **Fila do RH → "Prontos para ativar"** — a decisão final é do RH: botão
   **Ativar na empresa**. Depois do primeiro login do colaborador, ele recebe
   automaticamente o guia de abertura de chamados (com PDF anexo).

**Ponto de impacto:** ninguém mandou um e-mail à mão nesse fluxo inteiro.

## 3. Desligamento (4 min)

- Perfil do colaborador → **Desligar**: data, motivo, responsável da TI e o
  destino da conta Google — **manter, suspender ou excluir com backup do
  Drive** (mesmo fluxo do console do Google, sem abrir o console)
- Dois checklists gerados na hora (RH e TI); quando a TI conclui a parte dela
  na ferramenta de chamados, os itens **aparecem riscados para o RH sozinhos**

## 4. Governança — o que interessa ao CTO (4 min)

- **Log de auditoria**: toda ação com quem/quando/antes/depois
- **Histórico** nas duas filas: nada é apagado ao concluir
- **Notificações direcionadas**: o aviso vai para o analista atribuído e para
  o RH que abriu — não para o time inteiro
- **Papéis**: RH não vê ferramentas da TI e vice-versa; senha dos outros só
  Admin T.I/Superadmin trocam; área restrita (bloqueio de emergência) só TI
- **Exportação para o Drive**: um clique gera planilhas por status + o cadastro
  completo do QuarkRH (65 colunas) — auditoria e contratos
- **Instalável como app** (PWA) no desktop e no celular, sem loja
- **Central de ajuda** dentro do sistema: passo a passo escrito de cada
  tarefa + vídeos (menu → Central de ajuda) — treinamento sem depender da TI

## 5. Limitações honestas (1 min — falar antes que perguntem)

- O lançamento inicial no QuarkRH continua manual (API deles é só leitura;
  pedido de escrita já enviado ao fornecedor)
- E-mails pós-login saem em 5–10 min (ciclo de sincronização), não instantâneo
- O e-mail do Quark para criação de senha está pronto mas aguarda a URL do portal

## Perguntas prováveis

| Pergunta | Resposta curta |
|---|---|
| "E se a TI esquecer?" | O prazo conta na fila com alerta 24h/12h antes, direto para o analista responsável |
| "E se a pessoa já tiver conta?" | O sistema detecta e vincula, sem duplicar |
| "Quem pode ativar?" | Só o RH — a TI prepara, o RH decide |
| "E se o e-mail for criado fora do Google?" | Há um modo "apenas registrar" que adapta as credenciais ao webmail |
| "Isso substitui o Quark?" | Não — conversa com ele. O Quark segue sendo a fonte do RH |
