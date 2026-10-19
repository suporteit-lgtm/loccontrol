"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icone } from "@/components/Icone";
import { ThemeToggleButton } from "@/components/ThemeToggle";
import { ComoFunciona, FLUXO_ADMISSAO_TI } from "@/components/ComoFunciona";
import type { FatiaStatus } from "@/lib/types";
import s from "./dash.module.css";

interface Eq {
  nome: string;
  n: number;
  quem: string;
}

type Cor = React.CSSProperties & Record<`--${string}`, string>;

/** "Bruno, Ana" por equipamento → equipamentos de cada pessoa */
function porPessoa(lista: Eq[]) {
  const m = new Map<string, string[]>();
  for (const e of lista) for (const p of e.quem.split(", ").filter(Boolean)) m.set(p, [...(m.get(p) ?? []), e.nome]);
  return [...m.entries()].map(([nome, itens]) => ({ nome, itens })).sort((a, b) => b.itens.length - a.itens.length);
}

function Seta() {
  return (
    <svg width="8" height="13" viewBox="0 0 8 13" fill="none" aria-hidden="true">
      <path d="M1.5 1.5 6.5 6.5l-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Equipamentos({
  titulo,
  sub,
  lista,
  cor,
  vazioTitulo,
  vazioTexto,
}: {
  titulo: string;
  sub: string;
  lista: Eq[];
  cor: string;
  vazioTitulo: string;
  vazioTexto: string;
}) {
  const [modo, setModo] = useState<"item" | "pessoa">("item");
  const pessoas = porPessoa(lista);
  const total = lista.reduce((a, b) => a + b.n, 0);
  const estilo: Cor = { "--t": cor };

  return (
    <section className={s.secao} style={estilo}>
      <div className={s.secaoTopo}>
        <div>
          <h3 className={s.secaoTitulo}>{titulo}</h3>
          <p className={s.secaoSub}>
            {lista.length
              ? `${sub} · ${total} ${total === 1 ? "item" : "itens"}, ${pessoas.length} ${pessoas.length === 1 ? "pessoa" : "pessoas"}`
              : sub}
          </p>
        </div>
        {lista.length > 0 && (
          <div className={s.seg} role="group" aria-label="Agrupar por">
            <button type="button" aria-pressed={modo === "item"} onClick={() => setModo("item")}>
              Itens
            </button>
            <button type="button" aria-pressed={modo === "pessoa"} onClick={() => setModo("pessoa")}>
              Pessoas
            </button>
          </div>
        )}
      </div>

      <div className={s.lista}>
        {lista.length === 0 ? (
          <div className={s.vazio}>
            <span className={s.vazioIcone}>
              <Icone nome="equipamento" tamanho={22} />
            </span>
            <strong>{vazioTitulo}</strong>
            <p>{vazioTexto}</p>
          </div>
        ) : modo === "item" ? (
          lista.map((q) => (
            <div key={q.nome} className={s.linha}>
              <span className={s.linhaIcone}>
                <Icone nome="equipamento" />
              </span>
              <span className={s.linhaTxt}>
                <span className={s.linhaTitulo}>{q.nome}</span>
                <span className={s.linhaDet} title={q.quem}>
                  {q.quem}
                </span>
              </span>
              <span className={s.linhaValor}>{q.n}</span>
            </div>
          ))
        ) : (
          pessoas.map((p) => (
            <div key={p.nome} className={s.linha} style={{ alignItems: "flex-start", paddingTop: 12, paddingBottom: 12 }}>
              <span className={s.avatar} aria-hidden="true">
                {p.nome.slice(0, 2).toUpperCase()}
              </span>
              <span className={s.linhaTxt}>
                <span className={s.linhaTitulo}>{p.nome}</span>
                <span className={s.itens}>
                  {p.itens.map((i) => (
                    <span key={i}>{i}</span>
                  ))}
                </span>
              </span>
              <span className={s.linhaValor}>{p.itens.length}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
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
  const pct = (n: number) => (distribuicao.total ? Math.round((n / distribuicao.total) * 100) : 0);

  const kpis: { rotulo: string; n: number; cor: string; icone: string; rodape: string; href?: string }[] = [
    { rotulo: "Admissões na fila", n: stats.admissoes, cor: "var(--ios-blue)", icone: "wizard", rodape: "Abrir fila da TI", href: "/fila-ti" },
    {
      rotulo: "Desligamentos",
      n: stats.desligamentos,
      cor: "var(--ios-orange)",
      icone: "sair",
      rodape: stats.desligamentos ? "Abrir fila da TI" : "Nenhum em andamento",
      href: "/fila-ti",
    },
    {
      rotulo: "A separar",
      n: stats.separar,
      cor: "var(--ios-purple)",
      icone: "equipamento",
      rodape: `para ${stats.admissoes} ${stats.admissoes === 1 ? "admissão" : "admissões"}`,
    },
    {
      rotulo: "A receber",
      n: stats.receber,
      cor: "var(--ios-green)",
      icone: "equipamento",
      rodape: `de ${stats.desligamentos} ${stats.desligamentos === 1 ? "desligamento" : "desligamentos"}`,
    },
  ];

  return (
    <div className={s.root}>
      <div className={s.cabeca}>
        <div>
          <h1 className={s.tituloGrande}>Dashboard da TI</h1>
          <p className={s.subGrande}>{unidadeAtual} · equipamentos a partir do que o RH marcou em cada pré-admissão e desligamento</p>
        </div>
        <div className={s.cabecaAcoes}>
          <ComoFunciona titulo="Como funciona o chamado de admissão" passos={FLUXO_ADMISSAO_TI} />
          <ThemeToggleButton />
        </div>
      </div>

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
          const estilo: Cor = { "--k": k.cor };
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

      <div className={s.duas}>
        <Equipamentos
          titulo="A separar"
          sub="Admissões previstas"
          lista={eqEntregar}
          cor="var(--ios-purple)"
          vazioTitulo="Nada para separar"
          vazioTexto="Quando o RH marcar equipamentos numa pré-admissão, eles aparecem aqui."
        />
        <Equipamentos
          titulo="A receber"
          sub="Desligamentos em andamento"
          lista={eqReceber}
          cor="var(--ios-green)"
          vazioTitulo="Nenhum desligamento"
          vazioTexto="Os equipamentos a devolver de quem está saindo aparecem aqui."
        />
      </div>

      <section className={s.secao}>
        <div className={s.secaoTopo}>
          <div>
            <h3 className={s.secaoTitulo}>Chamados</h3>
            <p className={s.secaoSub}>
              {distribuicao.total} no total · distribuição por status
            </p>
          </div>
          <Link href="/fila-ti" className={s.link}>
            Ver fila
          </Link>
        </div>
        <div className={s.lista}>
          {distribuicao.total === 0 ? (
            <div className={s.vazio} style={{ "--t": "var(--ios-gray)" } as Cor}>
              <strong>Nenhum chamado ainda</strong>
            </div>
          ) : (
            <>
              <div className={s.status}>
                <div className={s.barra} role="img" aria-label={distribuicao.dados.map((d) => `${d.st}: ${d.n}`).join(", ")}>
                  {distribuicao.dados
                    .filter((d) => d.n > 0)
                    .map((d) => (
                      <span key={d.st} title={`${d.st}: ${d.n} (${pct(d.n)}%)`} style={{ flex: d.n, background: d.cor }} />
                    ))}
                </div>
                <div className={s.legenda}>
                  {distribuicao.dados.map((d) => (
                    <span key={d.st}>
                      <i style={{ background: d.cor }} />
                      {d.st}
                    </span>
                  ))}
                </div>
              </div>
              {distribuicao.dados.map((d) => (
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
    </div>
  );
}
