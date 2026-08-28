"use client";

import { useRouter } from "next/navigation";
import { PageHeader, StatCard, DistribuicaoStatus } from "@/components/ui";
import { ComoFunciona, FLUXO_ADMISSAO_TI } from "@/components/ComoFunciona";
import type { FatiaStatus } from "@/lib/types";

interface Eq {
  nome: string;
  n: number;
  quem: string;
}

export function DashTIClient({
  unidadeAtual,
  stats,
  eqEntregar,
  eqReceber,
  distribuicao,
}: {
  unidadeAtual: string;
  stats: { admissoes: number; desligamentos: number; separar: number; receber: number };
  eqEntregar: Eq[];
  eqReceber: Eq[];
  distribuicao: { dados: FatiaStatus[]; total: number };
}) {
  const router = useRouter();

  const linha = (q: Eq, corN?: string) => (
    <div
      key={q.nome}
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 10,
        padding: "7px 0",
        borderBottom: "1px solid var(--color-divider)",
      }}
    >
      <span style={{ fontSize: 14, minWidth: 130 }}>{q.nome}</span>
      <span className="text-muted" style={{ fontSize: 12, flex: 1 }}>
        {q.quem}
      </span>
      <span style={{ fontFamily: "var(--mono)", fontSize: 14, fontWeight: 500, color: corN }}>{q.n}</span>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <PageHeader
        eyebrow="Visão TI"
        titulo="Dashboard da TI"
        sub={`${unidadeAtual} · equipamentos calculados a partir do que o RH marcou em cada pré-admissão e desligamento`}
        acoes={<ComoFunciona titulo="Como funciona o chamado de admissão" passos={FLUXO_ADMISSAO_TI} />}
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "var(--space-3)" }}>
        <StatCard label="Admissões na fila" n={stats.admissoes} cor="var(--color-accent-700)" icone="wizard" onClick={() => router.push("/fila-ti")} />
        <StatCard label="Desligamentos" n={stats.desligamentos} cor="var(--warn-forte)" icone="sair" onClick={() => router.push("/fila-ti")} />
        <StatCard label="Equipamentos a separar" n={stats.separar} cor="var(--color-text)" icone="equipamento" />
        <StatCard label="Equipamentos a receber" n={stats.receber} cor="var(--ok)" icone="equipamento" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "var(--space-4)" }}>
        <div className="card">
          <span className="card-kicker">Admissões previstas</span>
          <span className="card-title">Equipamentos a separar</span>
          {eqEntregar.length > 0 ? (
            eqEntregar.map((q) => linha(q))
          ) : (
            <span className="text-muted" style={{ fontSize: 13 }}>
              Nenhuma admissão na fila
            </span>
          )}
        </div>
        <div className="card">
          <span className="card-kicker">Desligamentos em andamento</span>
          <span className="card-title">A receber no estoque</span>
          {eqReceber.length > 0 ? (
            eqReceber.map((q) => linha(q, "var(--ok-forte)"))
          ) : (
            <span className="text-muted" style={{ fontSize: 13 }}>
              Nenhum desligamento em andamento
            </span>
          )}
        </div>
      </div>
      <DistribuicaoStatus dados={distribuicao.dados} total={distribuicao.total} />
    </div>
  );
}
