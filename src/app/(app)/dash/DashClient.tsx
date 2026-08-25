"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader, StatCard, AvatarCircle, useNow } from "@/components/ui";
import { sla, dataBR } from "@/lib/format";

interface Props {
  unidadeAtual: string;
  stats: { ativos: number; afastados: number; pre: number; chamados: number };
  chart: { mes: string; a: number; d: number }[];
  proximas: {
    id: string;
    nome: string;
    cargo: string;
    admissao: string | null;
    slaAlvo: string | null;
    silenciado: boolean;
  }[];
}

export function DashClient({ unidadeAtual, stats, chart, proximas }: Props) {
  const router = useRouter();
  const now = useNow();

  // As barras são proporcionais ao maior mês — com dados reais (dezenas de
  // admissões) uma altura fixa por unidade estourava o card.
  const ALTURA = 104;
  const pico = Math.max(1, ...chart.flatMap((m) => [m.a, m.d]));
  const altura = (v: number) => (v === 0 ? 2 : Math.max(4, Math.round((v / pico) * ALTURA)));

  const cards = [
    { label: "Ativos", n: stats.ativos, cor: "var(--ok)", on: () => router.push("/colaboradores?status=Ativo") },
    { label: "Afastados", n: stats.afastados, cor: "var(--warn-forte)", on: () => router.push("/colaboradores?status=Afastado") },
    { label: "Pré-admissões", n: stats.pre, cor: "var(--color-accent-700)", on: () => router.push("/colaboradores?status=Pré-admissão") },
    { label: "Chamados pendentes", n: stats.chamados, cor: "var(--color-text)", on: () => router.push("/fila-ti") },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <PageHeader
        eyebrow="Visão RH"
        titulo="Dashboard"
        sub={unidadeAtual}
        acoes={
          <Link href="/pre-admissao" className="btn btn-primary">
            <span style={{ fontSize: 18, fontWeight: 400, marginRight: 4, lineHeight: 0.8 }}>+</span> Nova pré-admissão
          </Link>
        }
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "var(--space-3)",
        }}
      >
        {cards.map((s) => (
          <StatCard key={s.label} label={s.label} n={s.n} cor={s.cor} onClick={s.on} />
        ))}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "var(--space-4)",
        }}
      >
        <div className="card">
          <span className="card-kicker">Últimos 6 meses</span>
          <span className="card-title">Admissões × desligamentos</span>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 14, paddingTop: 8 }}>
            {chart.map((m) => (
              <div
                key={m.mes}
                className="chart-col"
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                  justifyContent: "flex-end",
                  position: "relative",
                }}
              >
                <div className="chart-tip">
                  <span style={{ color: "var(--ok)" }}>▪</span> {m.a} admiss{m.a === 1 ? "ão" : "ões"} ·{" "}
                  <span style={{ color: "var(--color-neutral-400)" }}>▪</span> {m.d} deslig.
                </div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: ALTURA }}>
                  <div
                    title={`${m.a} admissão(ões) em ${m.mes}`}
                    style={{ 
                      width: 16, 
                      height: altura(m.a), 
                      background: "var(--ok)",
                      borderRadius: "4px 4px 0 0",
                      boxShadow: "0 -4px 12px color-mix(in srgb, var(--ok) 25%, transparent)",
                      transition: "height 0.5s ease"
                    }}
                  />
                  <div
                    title={`${m.d} desligamento(s) em ${m.mes}`}
                    style={{ 
                      width: 16, 
                      height: altura(m.d), 
                      background: "var(--color-neutral-400)",
                      borderRadius: "4px 4px 0 0",
                      boxShadow: "0 -4px 12px color-mix(in srgb, var(--color-text) 12%, transparent)",
                      transition: "height 0.5s ease"
                    }}
                  />
                </div>
                <span className="text-muted" style={{ fontSize: 11, fontFamily: "var(--mono)" }}>
                  {m.mes}
                </span>
              </div>
            ))}
          </div>
          <div className="card-meta" style={{ gap: 14 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <i style={{ width: 10, height: 10, background: "var(--ok)" }} />
              admissões
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <i style={{ width: 10, height: 10, background: "var(--color-neutral-400)" }} />
              desligamentos
            </span>
          </div>
        </div>
        <div className="card">
          <span className="card-kicker">Ordenado por data</span>
          <span className="card-title">Próximas admissões</span>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {proximas.map((p) => {
              const sl = sla(p.slaAlvo, now);
              return (
                <div
                  key={p.id}
                  onClick={() => router.push(`/colaboradores/${p.id}`)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 0",
                    borderBottom: "1px solid var(--color-divider)",
                    cursor: "pointer",
                  }}
                >
                  <AvatarCircle nome={p.nome} tamanho={32} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14 }}>{p.nome}</div>
                    <div className="text-muted" style={{ fontSize: 12 }}>
                      {p.cargo} · {dataBR(p.admissao)}
                    </div>
                  </div>
                  <span
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: 13,
                      color: p.silenciado ? "var(--color-neutral-500)" : sl?.cor ?? "var(--color-neutral-500)",
                      fontWeight: p.silenciado ? 400 : sl?.peso ?? 400,
                    }}
                  >
                    {p.silenciado ? "🔕 silenciado" : sl?.txt ?? "—"}
                  </span>
                </div>
              );
            })}
            {proximas.length === 0 && (
              <div className="text-muted" style={{ fontSize: 13, padding: "10px 0" }}>
                Nenhuma pré-admissão nesta unidade
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
