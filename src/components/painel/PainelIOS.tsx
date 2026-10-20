"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icone } from "@/components/Icone";
import type { FatiaStatus } from "@/lib/types";
import s from "./ios.module.css";

/** Peças comuns dos dashboards no estilo iOS (RH e TI). */

export type CorVar = React.CSSProperties & Record<`--${string}`, string>;

export function Seta() {
  return (
    <svg width="8" height="13" viewBox="0 0 8 13" fill="none" aria-hidden="true">
      <path d="M1.5 1.5 6.5 6.5l-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export interface Kpi {
  rotulo: string;
  n: number;
  cor: string;
  icone: string;
  rodape: string;
  href?: string;
}

/** Widgets de números: 4 lado a lado, 2×2 no tablet e no celular. */
export function Widgets({ kpis }: { kpis: Kpi[] }) {
  const router = useRouter();
  return (
    <div className={s.kpis}>
      {kpis.map((k) => {
        const conteudo = (
          <>
            <span className={s.kpiTopo}>
              <span className={s.kpiIcone}>
                <Icone nome={k.icone} />
              </span>
              {k.href && (
                <span className={s.kpiSeta}>
                  <Seta />
                </span>
              )}
            </span>
            <span className={`${s.kpiNum} ${k.n === 0 ? s.kpiZero : ""}`}>{k.n}</span>
            <span className={s.kpiRotulo}>{k.rotulo}</span>
            <span className={s.kpiRodape}>{k.rodape}</span>
          </>
        );
        const estilo: CorVar = { "--k": k.cor };
        return k.href ? (
          <button key={k.rotulo} type="button" className={s.kpi} style={estilo} onClick={() => router.push(k.href!)}>
            {conteudo}
          </button>
        ) : (
          <div key={k.rotulo} className={s.kpi} style={estilo}>
            {conteudo}
          </div>
        );
      })}
    </div>
  );
}

/** Chamados por status: barra no estilo "Armazenamento do iPhone" + uma linha por status. */
export function StatusChamados({ dados, total, hrefFila }: { dados: FatiaStatus[]; total: number; hrefFila: string }) {
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  return (
    <section className={s.secao}>
      <div className={s.secaoTopo}>
        <div>
          <h3 className={s.secaoTitulo}>Chamados</h3>
          <p className={s.secaoSub}>{total} no total · distribuição por status</p>
        </div>
        <Link href={hrefFila} className={s.link}>
          Ver fila
        </Link>
      </div>
      <div className={s.lista}>
        {total === 0 ? (
          <div className={s.vazio} style={{ "--t": "var(--ios-gray)" } as CorVar}>
            <strong>Nenhum chamado ainda</strong>
          </div>
        ) : (
          <>
            <div className={s.status}>
              <div className={s.barra} role="img" aria-label={dados.map((d) => `${d.st}: ${d.n}`).join(", ")}>
                {dados
                  .filter((d) => d.n > 0)
                  .map((d) => (
                    <span key={d.st} title={`${d.st}: ${d.n} (${pct(d.n)}%)`} style={{ flex: d.n, background: d.cor }} />
                  ))}
              </div>
              <div className={s.legenda}>
                {dados.map((d) => (
                  <span key={d.st}>
                    <i style={{ background: d.cor }} />
                    {d.st}
                  </span>
                ))}
              </div>
            </div>
            {dados.map((d) => (
              <div key={d.st} className={s.linha}>
                <span className={s.linhaIcone} style={{ background: d.cor }}>
                  <Icone nome="fila" />
                </span>
                <span className={s.linhaTxt}>
                  <span className={s.linhaTitulo}>{d.st}</span>
                </span>
                <span className={s.linhaValor}>
                  {d.n} · {pct(d.n)}%
                </span>
              </div>
            ))}
          </>
        )}
      </div>
    </section>
  );
}
