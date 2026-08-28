/**
 * Central de ajuda (/ajuda): o passo a passo escrito de cada tarefa do
 * sistema. O texto vive aqui no código (versionado, revisável em PR);
 * o vídeo de cada guia é um link que o admin cola na própria tela
 * (tabela `ajuda_videos`, migration 0023).
 */

export type AreaGuia = "RH" | "TI" | "Geral";

export interface Guia {
  chave: string;
  area: AreaGuia;
  titulo: string;
  resumo: string;
  passos: string[];
}

export const GUIAS: Guia[] = [
  // ── RH ─────────────────────────────────────────────────────────────────────
  {
    chave: "rh-pre-admissao",
    area: "RH",
    titulo: "Cadastrar uma pré-admissão",
    resumo: "Do CPF ao chamado aberto para a TI — sem redigitar nada do Quark.",
    passos: [
      "Antes de tudo, cadastre o colaborador no QuarkRH — o LOCCONTROL busca os dados de lá.",
      "No menu, abra 'Nova pré-admissão' e busque a pessoa pelo CPF ou nome.",
      "Confira os dados, escolha o cargo — os acessos do cargo vêm da Matriz — e ajuste o que precisar.",
      "Escolha cidade e unidade: o grupo de e-mail da base entra sozinho. Marque os equipamentos necessários.",
      "Escolha o analista da TI responsável e conclua. O chamado abre com prazo pela data de admissão, espelhado no sistema de chamados, e só o analista escolhido é avisado.",
    ],
  },
  {
    chave: "rh-ativar",
    area: "RH",
    titulo: "Ativar (ou não ativar) na empresa",
    resumo: "A decisão final da admissão é do RH — a TI só prepara a conta.",
    passos: [
      "Quando a TI cria o e-mail, o card muda para 'Prontos para ativar' na Fila do RH e você recebe uma notificação.",
      "Clique em 'Ativar': o colaborador vira Ativo e, depois do primeiro login dele, os e-mails de boas-vindas saem sozinhos (5 min depois).",
      "Se a pessoa desistiu da vaga, clique em 'Não ativar': o chamado é cancelado e a conta criada é excluída do Workspace. A ficha permanece em Colaboradores como registro.",
      "Nada de e-mail manual: credenciais, boas-vindas e guia de chamados são automáticos.",
    ],
  },
  {
    chave: "rh-offboarding",
    area: "RH",
    titulo: "Registrar um desligamento",
    resumo: "Data, motivo, conta Google e dois checklists gerados na hora.",
    passos: [
      "Abra o perfil do colaborador (em Colaboradores) e clique em 'Desligar'.",
      "Informe data e motivo, escolha o responsável da TI e o destino da conta Google: manter, suspender ou excluir com backup do Drive.",
      "O sistema gera os checklists de saída (um do RH, um da TI) e abre o chamado para o responsável.",
      "Acompanhe pela Fila do RH (coluna Offboarding): quando a TI conclui a parte dela na ferramenta de chamados, os itens aparecem riscados sozinhos.",
      "Com os dois checklists completos, conclua o offboarding — tudo fica no Histórico.",
    ],
  },
  {
    chave: "rh-exportar",
    area: "RH",
    titulo: "Exportar as bases para o Drive",
    resumo: "Um clique gera as planilhas por status + o cadastro completo do Quark.",
    passos: [
      "Abra Colaboradores e clique em 'Exportar para o Drive'.",
      "O sistema gera uma planilha por status (Ativos, Pré-admissões, Afastados, Desligados) mais a geral — os contratos mudam entre elas.",
      "O cadastro completo do QuarkRH (todas as colunas do formulário de admissão) sai junto.",
      "Tudo é salvo em 'LOCCONTROL — Exportações' no Drive do suporte.it, com data e hora. O link aparece na tela ao terminar.",
    ],
  },
  // ── TI ─────────────────────────────────────────────────────────────────────
  {
    chave: "ti-chamado-admissao",
    area: "TI",
    titulo: "Atender um chamado de admissão",
    resumo: "Criar a conta, liberar acessos, separar equipamentos e concluir.",
    passos: [
      "O chamado aparece na sua fila com prazo pela data de admissão — se foi atribuído a você, só você o vê.",
      "Abra o chamado e informe o e-mail corporativo (a sugestão nome.sobrenome@ já vem pronta). O sistema cria a conta no Google Workspace e aplica os grupos.",
      "Se a conta foi criada fora do Workspace (webmail), marque 'o e-mail já foi criado em outro lugar' — o endereço é só registrado e as credenciais saem adaptadas ao webmail.",
      "As credenciais vão sozinhas para o e-mail pessoal do contratado, com a senha padrão (troca obrigatória no primeiro acesso).",
      "Criar a conta NÃO encerra o chamado: libere os acessos que o RH marcou e separe os equipamentos listados.",
      "Com tudo entregue, clique em 'Concluir chamado' (ou conclua na ferramenta de chamados — os dois lados conversam). O RH é avisado para ativar a pessoa.",
    ],
  },
  {
    chave: "ti-excluir-chamado",
    area: "TI",
    titulo: "Excluir um chamado da fila",
    resumo: "Cancelamento de admissão — e o que acontece com a conta criada.",
    passos: [
      "No card da fila, clique em 'Excluir'. O chamado sai da fila e vai para o Histórico como cancelado.",
      "Se era uma admissão e o e-mail já tinha sido criado, a conta é excluída do Workspace junto — o diálogo avisa antes.",
      "A conta de alguém já Ativo nunca é tocada por aqui; desligamento tem fluxo próprio (com backup do Drive).",
      "Não tem desfazer — na dúvida, use 'Silenciar alertas' em vez de excluir.",
    ],
  },
  {
    chave: "ti-grupos",
    area: "TI",
    titulo: "Grupos do Workspace",
    resumo: "Criar e excluir grupos de e-mail com aprovação da TI.",
    passos: [
      "A tela 'Grupos do Workspace' espelha os grupos reais do domínio, sincronizados a cada poucos minutos.",
      "O RH solicita criação/exclusão de grupo — o pedido vira um card na Fila da TI.",
      "'Executar e concluir' cria (ou exclui) o grupo de verdade no Workspace; 'Negar' recusa com registro.",
      "O grupo de e-mail de cada unidade fica em Unidades — é ele que entra sozinho em toda pré-admissão da base.",
    ],
  },
  {
    chave: "ti-usuarios",
    area: "TI",
    titulo: "Usuários e permissões",
    resumo: "Papéis, unidades de acesso e senha — quem vê e faz o quê.",
    passos: [
      "Em Usuários, crie a conta com nome, e-mail, papel e as unidades de acesso.",
      "Papéis: Usuário/Admin RH veem o lado do RH; Usuário/Admin T.I, o da TI; Superadmin vê tudo.",
      "Unidades de acesso vazias = todas as bases. Com unidades marcadas, a pessoa só vê os cards, colaboradores e avisos das bases dela.",
      "Senha: só Admin T.I e Superadmin definem ou redefinem a senha de outra pessoa (botão 'Senha').",
      "A senha inicial deve ser trocada pelo usuário no primeiro acesso.",
    ],
  },
  // ── Geral ──────────────────────────────────────────────────────────────────
  {
    chave: "geral-unidade",
    area: "Geral",
    titulo: "Filtro 'Minha unidade' e 'Todas as bases'",
    resumo: "O seletor do menu muda tudo — dashboards, filas e listas.",
    passos: [
      "No topo do menu, escolha a cidade e a unidade: todas as telas passam a mostrar só aquela base.",
      "'Todas as cidades' mostra o grupo inteiro de uma vez, com a coluna extra 'Base' em Colaboradores.",
      "Quem tem unidades de acesso definidas também vê a opção 'Todas' — mas ela mostra apenas as bases da pessoa.",
      "A escolha fica salva no navegador: ao voltar, o sistema abre onde você parou.",
    ],
  },
  {
    chave: "geral-notificacoes",
    area: "Geral",
    titulo: "Notificações — quem recebe o quê",
    resumo: "Navegador e e-mail, direcionados para não virar ruído.",
    passos: [
      "Chamado com analista atribuído: só ele é avisado (navegador e e-mail). O RH que abriu recebe o retorno ('Pronto para ativar').",
      "Avisos de SLA saem 24h e 12h antes do prazo, direto para o analista responsável.",
      "Quem tem unidades de acesso definidas só recebe avisos de colaboradores das bases dele.",
      "Em Configurações você liga/desliga cada canal (navegador, e-mail) e cada tipo de evento.",
    ],
  },
  {
    chave: "geral-historico",
    area: "Geral",
    titulo: "Histórico das filas",
    resumo: "Nada é apagado ao concluir — cada área vê o que é dela.",
    passos: [
      "Nas filas do RH e da TI, o botão 'Histórico' abre tudo o que já foi concluído, cancelado ou negado.",
      "O histórico da TI mostra todos os chamados e solicitações; o do RH, as admissões e desligamentos com cargo e base.",
      "Busque por nome ou número do chamado e filtre por tipo.",
      "Cada registro guarda quem concluiu e quando — junto com o Log de auditoria, é o rastro completo.",
    ],
  },
  {
    chave: "geral-instalar",
    area: "Geral",
    titulo: "Instalar como aplicativo",
    resumo: "O LOCCONTROL instala do navegador — sem loja, sem APK.",
    passos: [
      "No computador: com o sistema aberto no Chrome ou Edge, clique no ícone de instalar na barra de endereço (ou menu ⋮ → 'Instalar LOCCONTROL').",
      "No Android: menu ⋮ do Chrome → 'Adicionar à tela inicial'.",
      "No iPhone: botão de compartilhar do Safari → 'Adicionar à Tela de Início'.",
      "O app abre em janela própria, com ícone, e sempre na versão mais recente — atualização é automática.",
    ],
  },
];

export const AREAS: AreaGuia[] = ["RH", "TI", "Geral"];
