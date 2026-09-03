"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";

export interface PassoFluxo {
  titulo: string;
  quem: "RH" | "TI" | "Sistema";
  detalhe: string;
}

const COR_QUEM: Record<PassoFluxo["quem"], string> = {
  RH: "var(--color-accent)",
  TI: "var(--warn-forte)",
  Sistema: "var(--ok-forte)",
};

/**
 * Botão "Como funciona" + passo a passo do fluxo da tela. Existe para que
 * qualquer pessoa nova (RH, TI, gestão) entenda o processo sem treinamento —
 * cada tela-chave explica o próprio pedaço do fluxo.
 */
export function ComoFunciona({
  titulo,
  passos,
  /** Botão menor, pra caber em espaços apertados (ex.: dropdown do menu lateral). */
  pequeno,
}: {
  titulo: string;
  passos: PassoFluxo[];
  pequeno?: boolean;
}) {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <button
        className={pequeno ? "btn btn-secondary" : "btn btn-ghost"}
        onClick={() => setAberto(true)}
        title="Entenda o fluxo desta tela"
        style={pequeno ? { fontSize: 12.5, padding: "6px 10px" } : undefined}
      >
        ？ Como funciona
      </button>
      {aberto &&
        createPortal(
        <div className="dialog-backdrop" onClick={() => setAberto(false)}>
          <div className="dialog" style={{ width: "min(560px, 100%)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <span className="dialog-title">{titulo}</span>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setAberto(false)}
                aria-label="Fechar"
                title="Fechar"
                style={{ flex: "none", fontSize: 18, lineHeight: 1 }}
              >
                ✕
              </button>
            </div>
            <div className="dialog-body" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {passos.map((p, i) => (
                <div key={i} style={{ display: "flex", gap: 12, position: "relative", paddingBottom: 14 }}>
                  {/* trilho vertical ligando os passos */}
                  {i < passos.length - 1 && (
                    <span
                      aria-hidden
                      style={{
                        position: "absolute",
                        left: 13,
                        top: 28,
                        bottom: 0,
                        width: 2,
                        background: "var(--color-divider)",
                      }}
                    />
                  )}
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      flex: "none",
                      display: "grid",
                      placeItems: "center",
                      borderRadius: "50%",
                      border: `2px solid ${COR_QUEM[p.quem]}`,
                      color: COR_QUEM[p.quem],
                      fontWeight: 700,
                      fontSize: 13,
                      background: "var(--color-surface)",
                      zIndex: 1,
                    }}
                  >
                    {i + 1}
                  </span>
                  <div style={{ minWidth: 0, paddingTop: 2 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, fontSize: 14.5 }}>{p.titulo}</span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          padding: "1px 8px",
                          borderRadius: 999,
                          border: `1px solid ${COR_QUEM[p.quem]}`,
                          color: COR_QUEM[p.quem],
                        }}
                      >
                        {p.quem === "Sistema" ? "automático" : p.quem}
                      </span>
                    </div>
                    <div className="text-muted" style={{ fontSize: 13, marginTop: 2 }}>
                      {p.detalhe}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="dialog-actions">
              <Link href="/ajuda" className="btn btn-secondary" onClick={() => setAberto(false)}>
                Ver todos os guias
              </Link>
              <button className="btn btn-primary" onClick={() => setAberto(false)}>
                Entendi
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

/** Fluxo de admissão na visão do RH. */
export const FLUXO_ADMISSAO_RH: PassoFluxo[] = [
  {
    titulo: "Cadastrar a pré-admissão",
    quem: "RH",
    detalhe:
      "Em 'Nova pré-admissão', busque a pessoa pelo CPF ou nome — os dados vêm do QuarkRH. Escolha cargo, unidade, acessos e equipamentos. O chamado para a TI abre sozinho, com prazo pela data de admissão.",
  },
  {
    titulo: "TI prepara a conta",
    quem: "TI",
    detalhe:
      "A TI cria o e-mail corporativo e libera os acessos. Enquanto isso, o card fica na coluna 'Pré-admissões'. Você não precisa cobrar: a TI vê o prazo na fila dela.",
  },
  {
    titulo: "Ativar na empresa",
    quem: "RH",
    detalhe:
      "Quando a conta fica pronta, o card muda para 'Prontos para ativar' e você recebe uma notificação. Clique em 'Ativar na empresa' — este é o passo final, e é seu.",
  },
  {
    titulo: "E-mails automáticos",
    quem: "Sistema",
    detalhe:
      "As credenciais vão para o e-mail pessoal assim que a conta é criada. Depois do primeiro login, o colaborador recebe as boas-vindas com o guia do sistema de chamados. Ninguém precisa mandar nada à mão.",
  },
];

/** Fluxo de desligamento na visão do RH. */
export const FLUXO_OFFBOARDING_RH: PassoFluxo[] = [
  {
    titulo: "Registrar o desligamento",
    quem: "RH",
    detalhe:
      "No perfil do colaborador, clique em 'Desligar': informe data, motivo, o responsável da TI e o que fazer com a conta Google (manter, suspender ou excluir com backup do Drive).",
  },
  {
    titulo: "Checklists de saída",
    quem: "TI",
    detalhe:
      "O sistema gera dois checklists — um do RH, um da TI — e abre o chamado para o responsável escolhido. Quando a TI termina a parte dela, os itens aparecem riscados para você.",
  },
  {
    titulo: "Concluir o offboarding",
    quem: "RH",
    detalhe: "Com os dois checklists completos, conclua o offboarding. Tudo vai para o Histórico — nada se perde.",
  },
];

/** Fluxo do chamado de admissão na visão da TI. */
export const FLUXO_ADMISSAO_TI: PassoFluxo[] = [
  {
    titulo: "Chamado chega na fila",
    quem: "RH",
    detalhe:
      "O RH cadastra a pré-admissão e o chamado aparece aqui, atribuído a você, com prazo contando para a data de admissão. O card mostra quem abriu.",
  },
  {
    titulo: "Criar a conta",
    quem: "TI",
    detalhe:
      "Abra o chamado e informe o e-mail corporativo (o padrão nome.sobrenome já vem sugerido). Se a conta foi criada fora do Workspace, marque a opção e apenas registre o endereço. Isso NÃO encerra o chamado.",
  },
  {
    titulo: "Acessos e equipamentos",
    quem: "TI",
    detalhe:
      "Libere os acessos que o RH marcou e separe os equipamentos listados no chamado. Faça no seu ritmo — o chamado continua aberto na fila.",
  },
  {
    titulo: "Concluir o chamado",
    quem: "TI",
    detalhe:
      "Com tudo entregue, clique em 'Concluir chamado' (ou conclua na ferramenta de chamados — os dois lados conversam). O RH recebe o aviso e ativa a pessoa na empresa.",
  },
];
