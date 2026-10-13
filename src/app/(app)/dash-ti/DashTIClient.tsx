"use client";

import { useState } from "react";
import { Icone } from "@/components/Icone";
import { ThemeToggleButton } from "@/components/ThemeToggle";
import { ComoFunciona, FLUXO_ADMISSAO_TI } from "@/components/ComoFunciona";
import { StatusChamados, Widgets, type CorVar } from "@/components/painel/PainelIOS";
import type { FatiaStatus } from "@/lib/types";
import s from "@/components/painel/ios.module.css";

interface Eq {
  nome: string;
  n: number;
  quem: string;
}

/** "Bruno, Ana" por equipamento → equipamentos de cada pessoa */
function porPessoa(lista: Eq[]) {
  const m = new Map<string, string[]>();
  for (const e of lista) for (const p of e.quem.split(", ").filter(Boolean)) m.set(p, [...(m.get(p) ?? []), e.nome]);
  return [...m.entries()].map(([nome, itens]) => ({ nome, itens })).sort((a, b) => b.itens.length - a.itens.length);
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
  const estilo: CorVar = { "--t": cor };

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

      <Widgets
        kpis={[
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
        ]}
      />

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

      <StatusChamados dados={distribuicao.dados} total={distribuicao.total} hrefFila="/fila-ti" />
    </div>
  );
}
