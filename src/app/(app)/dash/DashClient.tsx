"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader, StatCard, AvatarCircle, DistribuicaoStatus, useNow } from "@/components/ui";
import { ComoFunciona, FLUXO_ADMISSAO_RH } from "@/components/ComoFunciona";
import { sla, dataBR, capitalizarNome } from "@/lib/format";
import type { FatiaStatus } from "@/lib/types";

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
  distribuicao: { dados: FatiaStatus[]; total: number };
}

interface Ponto {
  x: number;
  y: number;
  v: number;
  mes: string;
}

/** Curva suave entre os pontos (spline simples via bézier cúbica, ponto de
 *  controle na metade do trecho horizontal — sem depender de lib de gráfico). */
function curvaSuave(pontos: Ponto[]): string {
  if (pontos.length === 0) return "";
  let d = `M ${pontos[0].x} ${pontos[0].y}`;
  for (let i = 0; i < pontos.length - 1; i++) {
    const p0 = pontos[i];
    const p1 = pontos[i + 1];
    const meioX = (p0.x + p1.x) / 2;
    d += ` C ${meioX} ${p0.y}, ${meioX} ${p1.y}, ${p1.x} ${p1.y}`;
  }
  return d;
}

export function DashClient({ unidadeAtual, stats, chart, proximas, distribuicao }: Props) {
  const router = useRouter();
  const now = useNow();

  // Gráfico em área/linha (SVG puro, sem lib): mais fácil de ler tendência
  // ao longo de 6 meses do que barras — e não fica esquisito quando quase
  // todo mês é zero e só um tem movimento.
  const W = 600;
  const H = 150;
  const PAD_TOP = 24;
  const PAD_BOTTOM = 6;
  // margem horizontal: sem isso o primeiro/último ponto caem exatamente na
  // borda do viewBox e o glow/círculo do pico fica cortado pela lateral.
  const PAD_X = 14;
  const baseY = H - PAD_BOTTOM;
  const plotH = baseY - PAD_TOP;
  const plotW = W - 2 * PAD_X;
  const stepX = chart.length > 1 ? plotW / (chart.length - 1) : plotW;
  const pico = Math.max(1, ...chart.flatMap((m) => [m.a, m.d]));
  const yPara = (v: number) => baseY - (v / pico) * plotH;

  const pontosAdm: Ponto[] = chart.map((m, i) => ({ x: PAD_X + i * stepX, y: yPara(m.a), v: m.a, mes: m.mes }));
  const pontosDesl: Ponto[] = chart.map((m, i) => ({ x: PAD_X + i * stepX, y: yPara(m.d), v: m.d, mes: m.mes }));
  const areaAdm = pontosAdm.length
    ? `${curvaSuave(pontosAdm)} L ${pontosAdm[pontosAdm.length - 1].x} ${baseY} L ${pontosAdm[0].x} ${baseY} Z`
    : "";
  const picoAdm = Math.max(0, ...pontosAdm.map((p) => p.v));
  const totalAdm = chart.reduce((s, m) => s + m.a, 0);
  const totalDesl = chart.reduce((s, m) => s + m.d, 0);
  const saldo = totalAdm - totalDesl;

  const cards = [
    { label: "Ativos", n: stats.ativos, cor: "var(--ok)", icone: "colabs", on: () => router.push("/colaboradores?status=Ativo") },
    { label: "Afastados", n: stats.afastados, cor: "var(--warn-forte)", icone: "afastado", on: () => router.push("/colaboradores?status=Afastado") },
    { label: "Pré-admissões", n: stats.pre, cor: "var(--color-accent-700)", icone: "wizard", on: () => router.push("/colaboradores?status=Pré-admissão") },
    { label: "Chamados pendentes", n: stats.chamados, cor: "var(--color-text)", icone: "fila", on: () => router.push("/fila-ti") },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <PageHeader
        eyebrow="Visão RH"
        titulo="Dashboard"
        sub={unidadeAtual}
        acoes={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <ComoFunciona titulo="Como funciona a admissão" passos={FLUXO_ADMISSAO_RH} />
            <Link href="/pre-admissao" className="btn btn-primary">
              <span style={{ fontSize: 18, fontWeight: 400, marginRight: 4, lineHeight: 0.8 }}>+</span> Nova pré-admissão
            </Link>
          </div>
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
          <StatCard key={s.label} label={s.label} n={s.n} cor={s.cor} icone={s.icone} onClick={s.on} />
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
          <div style={{ paddingTop: 10 }}>
            <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
              <defs>
                <linearGradient id="gradAdmissoes" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--ok)" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="var(--ok)" stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* linhas de grade */}
              {[PAD_TOP, PAD_TOP + plotH / 2, baseY].map((y, i) => (
                <line key={i} x1={0} x2={W} y1={y} y2={y} stroke="var(--color-divider)" strokeWidth={1} strokeDasharray="2 6" />
              ))}

              {/* área sob a curva de admissões */}
              <path d={areaAdm} fill="url(#gradAdmissoes)" />

              {/* linha de desligamentos — tracejada, discreta */}
              <path d={curvaSuave(pontosDesl)} fill="none" stroke="var(--color-neutral-400)" strokeWidth={1.5} strokeDasharray="4 4" strokeLinecap="round" />
              {pontosDesl.map(
                (p, i) => p.v > 0 && <circle key={i} cx={p.x} cy={p.y} r={3} fill="var(--color-surface)" stroke="var(--color-neutral-400)" strokeWidth={1.5} />
              )}

              {/* linha de admissões — em destaque */}
              <path d={curvaSuave(pontosAdm)} fill="none" stroke="var(--ok)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
              {pontosAdm.map((p, i) => (
                <g key={i}>
                  {p.v > 0 && p.v === picoAdm && <circle cx={p.x} cy={p.y} r={9} fill="var(--ok)" opacity={0.18} />}
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={p.v > 0 ? 4 : 2.5}
                    fill={p.v > 0 ? "var(--ok)" : "var(--color-surface)"}
                    stroke="var(--ok)"
                    strokeWidth={p.v > 0 ? 0 : 1.5}
                  />
                  {p.v > 0 && (
                    <text x={p.x} y={p.y - 12} textAnchor="middle" fontSize={12} fontFamily="var(--mono)" fontWeight={700} fill="var(--color-text)">
                      {p.v}
                    </text>
                  )}
                  <title>
                    {p.mes}: {p.v} admiss{p.v === 1 ? "ão" : "ões"}
                  </title>
                </g>
              ))}
            </svg>
            <div style={{ display: "flex" }}>
              {chart.map((m) => (
                <span key={m.mes} className="text-muted" style={{ flex: 1, textAlign: "center", fontSize: 11, fontFamily: "var(--mono)" }}>
                  {m.mes}
                </span>
              ))}
            </div>
          </div>
          <div className="card-meta" style={{ gap: 14 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <i style={{ width: 12, height: 2, borderRadius: 1, background: "var(--ok)" }} />
              admissões
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <i
                style={{
                  width: 12,
                  height: 0,
                  borderTop: "1.5px dashed var(--color-neutral-400)",
                }}
              />
              desligamentos
            </span>
          </div>
          <div
            style={{
              display: "flex",
              gap: 28,
              marginTop: "auto",
              paddingTop: 16,
              borderTop: "1px solid var(--color-divider)",
            }}
          >
            {[
              { label: "Admissões · 6 meses", n: totalAdm, cor: "var(--ok)" },
              { label: "Desligamentos · 6 meses", n: totalDesl, cor: "var(--color-neutral-500)" },
              {
                label: "Saldo",
                n: saldo,
                cor: saldo > 0 ? "var(--ok)" : saldo < 0 ? "var(--danger)" : "var(--color-neutral-500)",
                sinal: saldo > 0,
              },
            ].map((s) => (
              <div key={s.label}>
                <div className="text-muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {s.label}
                </div>
                <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 24, color: s.cor }}>
                  {s.sinal ? `+${s.n}` : s.n}
                </div>
              </div>
            ))}
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
                    <div style={{ fontSize: 14 }}>{capitalizarNome(p.nome)}</div>
                    <div className="text-muted" style={{ fontSize: 12 }}>
                      {p.cargo} · {dataBR(p.admissao)}
                    </div>
                  </div>
                  {(p.silenciado || sl) && (
                    <span
                      style={{
                        fontFamily: "var(--mono)",
                        fontSize: 13,
                        color: p.silenciado ? "var(--color-neutral-500)" : sl?.cor,
                        fontWeight: p.silenciado ? 400 : sl?.peso,
                      }}
                    >
                      {p.silenciado ? "🔕 silenciado" : sl?.txt}
                    </span>
                  )}
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
      <DistribuicaoStatus dados={distribuicao.dados} total={distribuicao.total} />
    </div>
  );
}
