"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader, useNow } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { sla } from "@/lib/format";
import { ativarNaEmpresa } from "@/app/actions/colaboradores";

export interface CardRH {
  key: string;
  nome: string;
  id: string;
  sub: string;
  slaAlvo: string | null;
  urgCor: string;
  acao: string;
  href: string;
  /** O que ainda falta informar/revisar — vira chip no card. */
  pendencias?: string[];
  /** Preenchido quando a TI já entregou a conta: habilita "Ativar na empresa". */
  ativarColabId?: string;
}

export function Chips({ itens, cor }: { itens: string[]; cor: string }) {
  if (!itens.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      {itens.map((t) => (
        <span
          key={t}
          style={{
            fontSize: 10.5,
            lineHeight: 1.5,
            padding: "1px 7px",
            borderRadius: 999,
            border: `1px solid ${cor}`,
            color: cor,
            whiteSpace: "nowrap",
          }}
        >
          {t}
        </span>
      ))}
    </div>
  );
}

export function FilaRHClient({
  unidadeAtual,
  cols,
}: {
  unidadeAtual: string;
  cols: { label: string; cor: string; cards: CardRH[] }[];
}) {
  const now = useNow();
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();

  const ativar = (colabId: string) =>
    start(async () => {
      const res = await ativarNaEmpresa(colabId);
      toast(res.msg);
      router.refresh();
    });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <PageHeader
        eyebrow="Visão RH"
        titulo="Fila do RH"
        sub={`Tudo o que depende do RH agora · pré-admissões, offboarding, documentos e afastamentos · ${unidadeAtual}`}
        acoes={
          <Link href="/fila-rh/historico" className="btn btn-secondary">
            Histórico
          </Link>
        }
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "var(--space-3)",
          alignItems: "start",
        }}
      >
        {cols.map((col) => (
          <div key={col.label} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <h6 style={{ margin: 0, display: "flex", alignItems: "center", gap: 7, color: col.cor }}>
              <span style={{ width: 8, height: 8, flex: "none", borderRadius: "50%", background: col.cor }} />
              {col.label}
              <span style={{ fontFamily: "var(--mono)", marginLeft: "auto" }}>{col.cards.length}</span>
            </h6>
            {col.cards.length === 0 && (
              <div
                className="text-muted"
                style={{ border: "1px dashed var(--color-divider)", padding: 16, fontSize: 12, borderRadius: 10 }}
              >
                Nada aqui — bom sinal
              </div>
            )}
            {col.cards.map((k) => {
              const sl = sla(k.slaAlvo, now);
              return (
                <div key={k.key} className="card elev-sm" style={{ borderLeft: `3px solid ${k.urgCor}`, gap: 6, minHeight: 148 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontFamily: "var(--font-body)", fontWeight: 700, fontSize: 15 }}>{k.nome}</span>
                    <span style={{ fontFamily: "var(--mono)", fontSize: 11 }} className="text-muted">
                      {k.id}
                    </span>
                  </div>
                  <div
                    className="text-muted"
                    title={k.sub}
                    style={{ fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                  >
                    {k.sub}
                  </div>
                  {sl && (
                    <div style={{ fontFamily: "var(--mono)", fontSize: 13, color: sl.cor, fontWeight: sl.peso }}>
                      faltam {sl.txt}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8, marginTop: "auto", flexWrap: "wrap" }}>
                    <Link href={k.href} className="btn btn-secondary" style={{ fontSize: 13, padding: "4px 12px" }}>
                      {k.acao}
                    </Link>
                    {k.ativarColabId && (
                      <button
                        className="btn btn-primary"
                        style={{ fontSize: 13, padding: "4px 12px" }}
                        disabled={pending}
                        onClick={() => ativar(k.ativarColabId!)}
                      >
                        {pending ? "Ativando..." : "Ativar na empresa"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
