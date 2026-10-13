"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useNow } from "@/components/ui";
import { ComoFunciona, FLUXO_ADMISSAO_RH } from "@/components/ComoFunciona";
import { ThemeToggleButton } from "@/components/ThemeToggle";
import { Seta, StatusChamados, Widgets } from "@/components/painel/PainelIOS";
import { sla, dataBR, capitalizarNome } from "@/lib/format";
import type { FatiaStatus } from "@/lib/types";
import s from "@/components/painel/ios.module.css";

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

const PROXIMAS_POR_PAGINA = 8;

export function DashClient({ unidadeAtual, stats, chart, proximas, distribuicao }: Props) {
  const router = useRouter();
  const now = useNow();
  const [paginaProx, setPaginaProx] = useState(0);
  const totalPaginasProx = Math.max(1, Math.ceil(proximas.length / PROXIMAS_POR_PAGINA));
  const proximasPagina = proximas.slice(paginaProx * PROXIMAS_POR_PAGINA, paginaProx * PROXIMAS_POR_PAGINA + PROXIMAS_POR_PAGINA);

  // Gráfico em área/linha (SVG puro, sem lib)
  const W = 600;
  const H = 150;
  const PAD_TOP = 24;
  const PAD_BOTTOM = 6;
  const PAD_X = 14; // o primeiro/último ponto não encostam na borda
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
  const totalAdm = chart.reduce((t, m) => t + m.a, 0);
  const totalDesl = chart.reduce((t, m) => t + m.d, 0);
  const saldo = totalAdm - totalDesl;

  return (
    <div className={s.root}>
      <div className={s.cabeca}>
        <div>
          <h1 className={s.tituloGrande}>Dashboard</h1>
          <p className={s.subGrande}>{unidadeAtual}</p>
        </div>
        <div className={s.cabecaAcoes} style={{ flexWrap: "wrap" }}>
          <ComoFunciona titulo="Como funciona a admissão" passos={FLUXO_ADMISSAO_RH} />
          <ThemeToggleButton />
          <Link href="/pre-admissao" className={s.botao}>
            <span style={{ fontSize: 20, fontWeight: 400, lineHeight: 0.8 }}>+</span> Nova pré-admissão
          </Link>
        </div>
      </div>

      <Widgets
        kpis={[
          { rotulo: "Ativos", n: stats.ativos, cor: "var(--ios-green)", icone: "colabs", rodape: "Ver colaboradores", href: "/colaboradores?status=Ativo" },
          { rotulo: "Afastados", n: stats.afastados, cor: "var(--ios-orange)", icone: "afastado", rodape: "Ver afastados", href: "/colaboradores?status=Afastado" },
          { rotulo: "Pré-admissões", n: stats.pre, cor: "var(--ios-blue)", icone: "wizard", rodape: "Ver pré-admissões", href: "/colaboradores?status=Pré-admissão" },
          { rotulo: "Chamados pendentes", n: stats.chamados, cor: "var(--ios-purple)", icone: "fila", rodape: "Abrir fila do RH", href: "/fila-rh" },
        ]}
      />

      <div className={s.duas}>
        <section className={s.secao}>
          <div className={s.secaoTopo}>
            <div>
              <h3 className={s.secaoTitulo}>Admissões × desligamentos</h3>
              <p className={s.secaoSub}>Últimos 6 meses</p>
            </div>
          </div>
          <div className={s.lista}>
            <div className={s.grafico}>
              <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={chart.map((m) => `${m.mes}: ${m.a} admissões, ${m.d} desligamentos`).join("; ")}>
                <defs>
                  <linearGradient id="gradAdmissoesIOS" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--ios-green)" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="var(--ios-green)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {[PAD_TOP, PAD_TOP + plotH / 2, baseY].map((y, i) => (
                  <line key={i} x1={0} x2={W} y1={y} y2={y} stroke="var(--ios-sep)" strokeWidth={1} strokeDasharray="2 6" />
                ))}
                <path d={areaAdm} fill="url(#gradAdmissoesIOS)" />
                <path d={curvaSuave(pontosDesl)} fill="none" stroke="var(--ios-gray)" strokeWidth={1.5} strokeDasharray="4 4" strokeLinecap="round" />
                {pontosDesl.map(
                  (p, i) => p.v > 0 && <circle key={i} cx={p.x} cy={p.y} r={3} fill="var(--ios-card)" stroke="var(--ios-gray)" strokeWidth={1.5} />,
                )}
                <path d={curvaSuave(pontosAdm)} fill="none" stroke="var(--ios-green)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                {pontosAdm.map((p, i) => (
                  <g key={i}>
                    {p.v > 0 && p.v === picoAdm && <circle cx={p.x} cy={p.y} r={9} fill="var(--ios-green)" opacity={0.18} />}
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={p.v > 0 ? 4 : 2.5}
                      fill={p.v > 0 ? "var(--ios-green)" : "var(--ios-card)"}
                      stroke="var(--ios-green)"
                      strokeWidth={p.v > 0 ? 0 : 1.5}
                    />
                    {p.v > 0 && (
                      <text x={p.x} y={p.y - 12} textAnchor="middle" fontSize={13} fontWeight={600} fill="var(--ios-label)">
                        {p.v}
                      </text>
                    )}
                    <title>
                      {p.mes}: {p.v} admiss{p.v === 1 ? "ão" : "ões"}
                    </title>
                  </g>
                ))}
              </svg>
              <div className={s.meses}>
                {chart.map((m) => (
                  <span key={m.mes}>{m.mes}</span>
                ))}
              </div>
            </div>
            <div className={s.legendaGraf}>
              <span>
                <i style={{ width: 12, height: 2.5, borderRadius: 2, background: "var(--ios-green)", display: "inline-block" }} />
                Admissões
              </span>
              <span>
                <i style={{ width: 12, height: 0, borderTop: "1.5px dashed var(--ios-gray)", display: "inline-block" }} />
                Desligamentos
              </span>
            </div>
            <div className={s.resumo3}>
              <div>
                <small>Admissões</small>
                <strong style={{ color: "var(--ios-green)" }}>{totalAdm}</strong>
              </div>
              <div>
                <small>Desligamentos</small>
                <strong style={{ color: "var(--ios-gray)" }}>{totalDesl}</strong>
              </div>
              <div>
                <small>Saldo</small>
                <strong style={{ color: saldo > 0 ? "var(--ios-green)" : saldo < 0 ? "#ff3b30" : "var(--ios-gray)" }}>
                  {saldo > 0 ? `+${saldo}` : saldo}
                </strong>
              </div>
            </div>
          </div>
        </section>

        <section className={s.secao}>
          <div className={s.secaoTopo}>
            <div>
              <h3 className={s.secaoTitulo}>Próximas admissões</h3>
              <p className={s.secaoSub}>
                {proximas.length} {proximas.length === 1 ? "pré-admissão" : "pré-admissões"} · por data
              </p>
            </div>
            {proximas.length > PROXIMAS_POR_PAGINA && (
              <div className={s.paginas}>
                <span>
                  {paginaProx * PROXIMAS_POR_PAGINA + 1}–{Math.min(proximas.length, (paginaProx + 1) * PROXIMAS_POR_PAGINA)} de {proximas.length}
                </span>
                <button type="button" disabled={paginaProx === 0} onClick={() => setPaginaProx((p) => Math.max(0, p - 1))} aria-label="Página anterior">
                  <span style={{ transform: "scaleX(-1)", display: "flex" }}>
                    <Seta />
                  </span>
                </button>
                <button
                  type="button"
                  disabled={paginaProx >= totalPaginasProx - 1}
                  onClick={() => setPaginaProx((p) => Math.min(totalPaginasProx - 1, p + 1))}
                  aria-label="Próxima página"
                >
                  <Seta />
                </button>
              </div>
            )}
          </div>
          <div className={s.lista}>
            {proximas.length === 0 ? (
              <div className={s.vazio} style={{ "--t": "var(--ios-blue)" } as React.CSSProperties}>
                <strong>Nenhuma pré-admissão</strong>
                <p>As próximas admissões desta unidade aparecem aqui, da mais próxima para a mais distante.</p>
              </div>
            ) : (
              proximasPagina.map((p) => {
                const sl = sla(p.slaAlvo, now);
                return (
                  <button key={p.id} type="button" className={s.linha} onClick={() => router.push(`/colaboradores/${p.id}`)}>
                    <span className={s.avatar} aria-hidden="true">
                      {capitalizarNome(p.nome)
                        .split(" ")
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()}
                    </span>
                    <span className={s.linhaTxt}>
                      <span className={s.linhaTitulo}>{capitalizarNome(p.nome)}</span>
                      <span className={s.linhaDet}>
                        {p.cargo} · {dataBR(p.admissao)}
                      </span>
                    </span>
                    {(p.silenciado || sl) && (
                      <span
                        className={s.linhaValor}
                        style={{ fontSize: 13, color: p.silenciado ? "var(--ios-gray)" : sl?.cor, fontWeight: p.silenciado ? 400 : sl?.peso }}
                      >
                        {p.silenciado ? "Silenciado" : sl?.txt}
                      </span>
                    )}
                    <span className={s.linhaSeta}>
                      <Seta />
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </section>
      </div>

      <StatusChamados dados={distribuicao.dados} total={distribuicao.total} hrefFila="/fila-rh" />
    </div>
  );
}
