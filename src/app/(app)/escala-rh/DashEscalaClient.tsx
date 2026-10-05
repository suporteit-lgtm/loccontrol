"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader, StatCard } from "@/components/ui";
import { SelectCustom } from "@/components/SelectCustom";
import { GrupoBadge } from "@/components/escala/GrupoBadge";
import { somarDias } from "@/lib/escala/calendario";
import { dataCurta, nomeMes } from "@/lib/escala/formato";
import { csv, type PessoaFreq } from "@/lib/escala/metricas";
import type { Dashboard } from "@/lib/escala/dashboard";

const COR = { A: "var(--color-accent)", B: "var(--ok)" } as const;
const pctTxt = (v: number | null) => (v === null ? "—" : `${v.toLocaleString("pt-BR")}%`);

function baixar(nome: string, conteudo: string) {
  const blob = new Blob(["﻿" + conteudo], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  a.click();
  URL.revokeObjectURL(a.href);
}

function mesAnterior(hoje: string): [string, string] {
  const [a, m] = hoje.split("-").map(Number);
  const ini = new Date(Date.UTC(a, m - 2, 1)).toISOString().slice(0, 10);
  const fim = new Date(Date.UTC(a, m - 1, 0)).toISOString().slice(0, 10);
  return [ini, fim];
}

// ── Gráficos (SVG puro, mesmo padrão do Dashboard RH) ────────────────────────
function OcupacaoDiaria({ dias, capacidade }: { dias: Dashboard["dias"]; capacidade: number }) {
  const W = 640;
  const H = 170;
  const T = 18;
  const B = H - 6;
  const max = Math.max(capacidade, ...dias.map((d) => d.presentes)) * 1.08;
  const y = (v: number) => B - (v / max) * (B - T);
  const passo = dias.length ? (W - 8) / dias.length : 0;
  const larg = Math.max(2, Math.min(22, passo * 0.7));
  if (!dias.length) return <p className="text-muted" style={{ fontSize: 13 }}>Nenhum dia útil no período.</p>;
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
        {[T, (T + B) / 2, B].map((yy, i) => (
          <line key={i} x1={0} x2={W} y1={yy} y2={yy} stroke="var(--color-divider)" strokeDasharray="2 6" />
        ))}
        {dias.map((d, i) => {
          const x = 4 + i * passo + (passo - larg) / 2;
          const cor = d.grupo ? COR[d.grupo] : "var(--color-neutral-400)";
          return (
            <g key={d.data}>
              <rect x={x} y={y(d.presentes)} width={larg} height={B - y(d.presentes)} rx={3} fill={cor} opacity={d.futuro ? 0.35 : 0.85} />
              <title>
                {dataCurta(d.data)}{d.grupo ? ` · Grupo ${d.grupo}` : " · livre"}: {d.presentes} de {d.capacidade}
                {d.futuro ? " (previsto)" : ""}
              </title>
            </g>
          );
        })}
        <line x1={0} x2={W} y1={y(capacidade)} y2={y(capacidade)} stroke="var(--danger)" strokeWidth={1.5} strokeDasharray="6 4" />
        <text x={W - 4} y={y(capacidade) - 5} textAnchor="end" fontSize={11} fontFamily="var(--mono)" fill="var(--danger)">
          capacidade {capacidade}
        </text>
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between" }} className="text-muted">
        <span style={{ fontSize: 11, fontFamily: "var(--mono)" }}>{dataCurta(dias[0].data)}</span>
        <span style={{ fontSize: 11, fontFamily: "var(--mono)" }}>{dataCurta(dias[dias.length - 1].data)}</span>
      </div>
    </>
  );
}

function Barras({ itens }: { itens: { rotulo: string; valor: number | null; dica: string }[] }) {
  const max = Math.max(1, ...itens.map((i) => i.valor ?? 0));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 6 }}>
      {itens.map((i) => (
        <div key={i.rotulo} title={i.dica} style={{ display: "grid", gridTemplateColumns: "38px 1fr 56px", gap: 10, alignItems: "center", fontSize: 13 }}>
          <span className="text-muted">{i.rotulo}</span>
          <div style={{ height: 10, borderRadius: 999, background: "var(--color-neutral-200)", overflow: "hidden" }}>
            <div style={{ width: `${((i.valor ?? 0) / max) * 100}%`, height: "100%", background: "var(--warn-forte)", borderRadius: 999 }} />
          </div>
          <strong style={{ fontFamily: "var(--mono)", textAlign: "right" }}>{pctTxt(i.valor)}</strong>
        </div>
      ))}
    </div>
  );
}

function AxBMensal({ meses }: { meses: Dashboard["abMensal"] }) {
  if (!meses.length) return <p className="text-muted" style={{ fontSize: 13 }}>Sem dias fixos ainda.</p>;
  const max = Math.max(1, ...meses.flatMap((m) => [m.a, m.b]));
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-end", height: 150, paddingTop: 10 }}>
      {meses.map((m) => {
        const [ano, mm] = m.mes.split("-").map(Number);
        return (
          <div key={m.mes} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: 0 }}>
            <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 110 }} title={`${nomeMes(mm)}/${ano}: A ${m.a} × B ${m.b} (acumulado)`}>
              {(["A", "B"] as const).map((g) => (
                <div key={g} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                  <span style={{ fontSize: 10.5, fontFamily: "var(--mono)" }}>{g === "A" ? m.a : m.b}</span>
                  <div style={{ width: 14, height: `${((g === "A" ? m.a : m.b) / max) * 92}px`, background: COR[g], borderRadius: "4px 4px 0 0", opacity: 0.85 }} />
                </div>
              ))}
            </div>
            <span className="text-muted" style={{ fontSize: 11, fontFamily: "var(--mono)" }}>{nomeMes(mm).slice(0, 3)}</span>
          </div>
        );
      })}
    </div>
  );
}

function MapaPrevisao({ dias }: { dias: Dashboard["previsao"] }) {
  if (!dias.length) return <p className="text-muted" style={{ fontSize: 13 }}>A escala dos próximos 30 dias ainda não foi gerada.</p>;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(54px, 1fr))", gap: 6, paddingTop: 6 }}>
      {dias.map((d) => (
        <div
          key={d.data}
          title={`${dataCurta(d.data)}${d.grupo ? ` · Grupo ${d.grupo}` : " · livre"}: ${d.presentes} de ${d.capacidade} previstos · ${d.vagas} vaga(s)`}
          style={{
            borderRadius: 8,
            padding: "6px 4px",
            textAlign: "center",
            background: `color-mix(in srgb, var(--color-accent) ${Math.round(8 + Math.min(100, d.ocupacao) * 0.6)}%, transparent)`,
            outline: d.poucas ? "2px solid var(--danger)" : "none",
            outlineOffset: -2,
          }}
        >
          <div style={{ fontSize: 10.5 }}>{dataCurta(d.data).slice(0, 3)} · {d.grupo ?? "livre"}</div>
          <div style={{ fontSize: 11, fontFamily: "var(--mono)" }}>{d.data.slice(8, 10)}/{d.data.slice(5, 7)}</div>
          <div style={{ fontSize: 14, fontWeight: 800 }}>{d.vagas}</div>
        </div>
      ))}
    </div>
  );
}

// ── Tela ─────────────────────────────────────────────────────────────────────
type Coluna = keyof Pick<PessoaFreq, "nome" | "grupo" | "escalados" | "presencas" | "ausencias" | "emCima" | "reservasUsadas" | "frequencia">;
const COLUNAS: { k: Coluna; t: string }[] = [
  { k: "nome", t: "Nome" },
  { k: "grupo", t: "Grupo" },
  { k: "escalados", t: "Escalado" },
  { k: "presencas", t: "Presenças" },
  { k: "ausencias", t: "Ausências" },
  { k: "emCima", t: "Em cima da hora" },
  { k: "reservasUsadas", t: "Reservas usadas" },
  { k: "frequencia", t: "% frequência" },
];

export function DashEscalaClient({ d }: { d: Dashboard }) {
  const router = useRouter();
  const f = d.filtros;
  const [ordem, setOrdem] = useState<{ k: Coluna; desc: boolean }>({ k: "nome", desc: false });

  const ir = (mud: Partial<typeof f>) => {
    const n = { ...f, ...mud };
    const q = new URLSearchParams();
    q.set("de", n.de);
    q.set("ate", n.ate);
    if (n.grupo) q.set("grupo", n.grupo);
    if (n.pessoa) q.set("pessoa", n.pessoa);
    router.push(`/escala-rh?${q}`);
  };

  const rotuloPessoa = new Map(d.pessoasOpcoes.map((p) => [p.id, `${p.nome} (${p.grupo})`]));
  const idPorRotulo = new Map([...rotuloPessoa].map(([id, r]) => [r, id]));

  const linhas = useMemo(() => {
    const l = [...d.frequencia];
    l.sort((a, b) => {
      const va = a[ordem.k];
      const vb = b[ordem.k];
      const c = typeof va === "string" ? va.localeCompare(String(vb)) : (va ?? -1) - ((vb as number | null) ?? -1);
      return ordem.desc ? -c : c;
    });
    return l;
  }, [d.frequencia, ordem]);

  const c = d.cards;
  const periodo = `${dataCurta(f.de)} a ${dataCurta(f.ate)}`;
  const sufixo = `${f.de}_a_${f.ate}${f.grupo ? `_grupo-${f.grupo}` : ""}`;

  const exportarDias = () =>
    baixar(`escala-dias_${sufixo}.csv`, csv(
      ["Data", "Grupo do dia", "Capacidade", "Escalados", "Afastados", "Ausências", "Em cima da hora", "Reservas", "Presentes", "Ocupação %", "Fila", "Fila sem atendimento", "Ofertas expiradas", "Previsto"],
      d.dias.map((x) => [x.data, x.grupo ?? "livre", x.capacidade, x.escalados, x.afastados, x.ausencias, x.emCima, x.reservas, x.presentes,
        Math.round((x.presentes / x.capacidade) * 1000) / 10, x.fila, x.filaSemAtendimento, x.ofertasExpiradas, x.futuro ? "sim" : "não"]),
    ));
  const exportarPessoas = () =>
    baixar(`escala-frequencia_${sufixo}.csv`, csv(
      ["Nome", "Grupo", "Dias escalados", "Presenças", "Ausências", "Em cima da hora", "Afastado (dias)", "Reservas usadas", "% frequência"],
      linhas.map((p) => [p.nome, p.grupo, p.escalados, p.presencas, p.ausencias, p.emCima, p.afastados, p.reservasUsadas, p.frequencia]),
    ));

  const [mpIni, mpFim] = mesAnterior(d.hoje);
  const presets: { t: string; de: string; ate: string }[] = [
    { t: "Este mês", de: `${d.hoje.slice(0, 7)}-01`, ate: d.hoje },
    { t: "Mês passado", de: mpIni, ate: mpFim },
    { t: "Últimos 90 dias", de: somarDias(d.hoje, -90), ate: d.hoje },
    { t: "Próximos 30 dias", de: somarDias(d.hoje, 1), ate: somarDias(d.hoje, 30) },
  ];

  return (
    <div className="print-area" style={{ display: "flex", flexDirection: "column", gap: "var(--space-5, 20px)" }}>
      <PageHeader
        eyebrow="Escala de Presença"
        titulo="Dashboard da Escala"
        sub={`${d.unidades[0].nome} · ${periodo}${f.grupo ? ` · Grupo ${f.grupo}` : ""}${f.pessoa ? ` · ${rotuloPessoa.get(f.pessoa) ?? ""}` : ""}`}
        themeToggle
        acoes={
          <div className="no-print" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-secondary" onClick={exportarDias}>CSV por dia</button>
            <button className="btn btn-secondary" onClick={exportarPessoas}>CSV por pessoa</button>
            <button className="btn btn-secondary" onClick={() => window.print()}>PDF</button>
          </div>
        }
      />

      <section className="card elev-sm no-print" style={{ gap: 10 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <label className="text-muted" style={{ fontSize: 12, display: "flex", gap: 6, alignItems: "center" }}>
            De <input className="input" type="date" value={f.de} onChange={(e) => e.target.value && ir({ de: e.target.value })} />
          </label>
          <label className="text-muted" style={{ fontSize: 12, display: "flex", gap: 6, alignItems: "center" }}>
            Até <input className="input" type="date" value={f.ate} onChange={(e) => e.target.value && ir({ ate: e.target.value })} />
          </label>
          <SelectCustom className="input" style={{ minWidth: 170 }} value={d.unidades[0].nome} options={d.unidades.map((u) => u.nome)} onChange={() => {}} />
          <SelectCustom
            className="input"
            style={{ minWidth: 140 }}
            value={f.grupo ? `Grupo ${f.grupo}` : "Todos os grupos"}
            options={["Todos os grupos", "Grupo A", "Grupo B"]}
            onChange={(v) => ir({ grupo: v === "Grupo A" ? "A" : v === "Grupo B" ? "B" : "", pessoa: "" })}
          />
          <SelectCustom
            className="input"
            style={{ minWidth: 220 }}
            value={f.pessoa ? (rotuloPessoa.get(f.pessoa) ?? "Todas as pessoas") : "Todas as pessoas"}
            options={["Todas as pessoas", ...rotuloPessoa.values()]}
            onChange={(v) => ir({ pessoa: idPorRotulo.get(v) ?? "" })}
          />
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {presets.map((p) => (
            <button
              key={p.t}
              className={`btn ${p.de === f.de && p.ate === f.ate ? "btn-primary" : "btn-ghost"}`}
              style={{ fontSize: 12, padding: "4px 10px" }}
              onClick={() => ir({ de: p.de, ate: p.ate })}
            >
              {p.t}
            </button>
          ))}
          {(f.grupo || f.pessoa) && (
            <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => ir({ grupo: "", pessoa: "" })}>Limpar filtros</button>
          )}
        </div>
      </section>

      <p className="text-muted" style={{ fontSize: 12.5, margin: 0 }}>
        <strong>Presença = escala − ausências avisadas − afastamentos.</strong> Os cards consideram só os dias já realizados (até hoje). O motivo de
        ausências e afastamentos nunca é registrado (LGPD).
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "var(--space-3)" }}>
        <StatCard label="Ocupação média" n={pctTxt(c.ocupacaoMedia)} cor="var(--color-accent-700)" icone="colabs" rodape={`${c.diasRealizados} dia(s) útil(eis) realizados`} />
        <StatCard label="Taxa de ausência" n={pctTxt(c.taxaAusencia)} cor="var(--warn-forte)" icone="afastado" rodape="ausências ÷ escalados não afastados" />
        <StatCard label="Reservas usadas / oferecidas" n={`${c.reservasUsadas}/${c.vagasOferecidas}`} cor="var(--ok)" icone="calendario" rodape="agendamentos ÷ vagas abertas" />
        <StatCard label="Dias com fila" n={c.diasComFila} cor="var(--color-text)" icone="fila" rodape="mais procura que lugares" />
        <StatCard
          label="Diferença A×B"
          n={c.difAB}
          cor={c.difAB <= 1 ? "var(--ok)" : "var(--danger)"}
          icone="calendario"
          rodape={`acumulado: A ${c.diasA} × B ${c.diasB} (ideal 0 ou 1)`}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "var(--space-4)" }}>
        <div className="card" style={{ gridColumn: "1 / -1" }}>
          <span className="card-kicker">{periodo} · barras claras = previsto</span>
          <span className="card-title">Ocupação diária</span>
          <OcupacaoDiaria dias={d.dias} capacidade={d.capacidade} />
          <div className="card-meta" style={{ gap: 14 }}>
            <span style={{ display: "inline-flex", gap: 5, alignItems: "center" }}><GrupoBadge grupo="A" /> dia do A</span>
            <span style={{ display: "inline-flex", gap: 5, alignItems: "center" }}><GrupoBadge grupo="B" /> dia do B</span>
            <span style={{ display: "inline-flex", gap: 5, alignItems: "center" }}>
              <i style={{ width: 10, height: 10, borderRadius: 3, background: "var(--color-neutral-400)" }} /> dia livre
            </span>
          </div>
        </div>
        <div className="card">
          <span className="card-kicker">Dias realizados no período</span>
          <span className="card-title">Ausência por dia da semana</span>
          <Barras
            itens={d.ausenciaSemana.map((s) => ({
              rotulo: s.dia,
              valor: s.taxa,
              dica: s.base ? `${s.ausencias} ausência(s) em ${s.base} escalação(ões)` : "sem grupo fixo neste dia",
            }))}
          />
          <span className="text-muted" style={{ fontSize: 12 }}>Ter a qui são dias livres (sem escalados), por isso aparecem com “—”.</span>
        </div>
        <div className="card">
          <span className="card-kicker">Desde a âncora · acumulado</span>
          <span className="card-title">Dias de A × B por mês</span>
          <AxBMensal meses={d.abMensal} />
        </div>
        <div className="card" style={{ gridColumn: "1 / -1" }}>
          <span className="card-kicker">Próximos 30 dias · número = vagas livres</span>
          <span className="card-title">Previsão de ocupação</span>
          <MapaPrevisao dias={d.previsao} />
          <span className="text-muted" style={{ fontSize: 12 }}>
            Quanto mais escuro, mais cheio. Contorno vermelho = poucas vagas (até 15% da capacidade).{" "}
            {d.previsao.filter((x) => x.poucas).length > 0 && <strong>{d.previsao.filter((x) => x.poucas).length} dia(s) com poucas vagas.</strong>}
          </span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "var(--space-4)" }}>
        <div className="card" style={{ gridColumn: "span 2", minWidth: 0 }}>
          <span className="card-kicker">Clique no nome para ver o histórico · clique no título para ordenar</span>
          <span className="card-title">Frequência por pessoa</span>
          {linhas.length === 0 ? (
            <p className="text-muted" style={{ fontSize: 13 }}>Nenhum participante com esses filtros.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="table" style={{ minWidth: 720, fontSize: 13 }}>
                <thead>
                  <tr>
                    {COLUNAS.map((col) => (
                      <th
                        key={col.k}
                        onClick={() => setOrdem((o) => ({ k: col.k, desc: o.k === col.k ? !o.desc : col.k !== "nome" && col.k !== "grupo" }))}
                        style={{ cursor: "pointer", whiteSpace: "nowrap", textAlign: col.k === "nome" || col.k === "grupo" ? "left" : "right" }}
                      >
                        {col.t}{ordem.k === col.k ? (ordem.desc ? " ↓" : " ↑") : ""}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((p) => (
                    <tr key={p.id}>
                      <td><Link href={`/escala-rh/pessoa/${p.id}`} style={{ color: "var(--color-accent-700)" }}>{p.nome}</Link></td>
                      <td><GrupoBadge grupo={p.grupo} /></td>
                      {(["escalados", "presencas", "ausencias", "emCima", "reservasUsadas"] as const).map((k) => (
                        <td key={k} style={{ textAlign: "right", fontFamily: "var(--mono)" }}>{p[k]}</td>
                      ))}
                      <td
                        style={{
                          textAlign: "right",
                          fontFamily: "var(--mono)",
                          fontWeight: 700,
                          color: p.frequencia === null ? undefined : p.frequencia >= 80 ? "var(--ok-forte)" : p.frequencia >= 50 ? "var(--warn-forte)" : "var(--danger)",
                        }}
                      >
                        {pctTxt(p.frequencia)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="card">
          <span className="card-kicker">Fila que terminou sem vaga</span>
          <span className="card-title">Demanda reprimida</span>
          <p style={{ fontSize: 14, margin: 0 }}>
            {d.demanda.diasSemAtendimento === 0
              ? "Neste período ninguém ficou sem lugar: toda fila foi atendida."
              : `Em ${d.demanda.diasSemAtendimento} dia(s) deste período houve mais procura que lugares — ${d.demanda.pessoasSemVaga} pedido(s) não foram atendidos.`}
          </p>
          <div style={{ display: "flex", gap: 24, paddingTop: 6 }}>
            {[
              { t: "Fila média", v: d.demanda.filaMedia.toLocaleString("pt-BR") },
              { t: "Ofertas expiradas", v: d.demanda.ofertasExpiradas },
              { t: "Dias com fila", v: c.diasComFila },
            ].map((x) => (
              <div key={x.t}>
                <div className="text-muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>{x.t}</div>
                <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 24 }}>{x.v}</div>
              </div>
            ))}
          </div>
          {d.demanda.dias.length > 0 && (
            <div className="esc-lista" style={{ maxHeight: 220, overflowY: "auto" }}>
              {d.demanda.dias.map((x) => (
                <div key={x.data} className="esc-linha" style={{ padding: "6px 0", fontSize: 13 }}>
                  <span>{dataCurta(x.data)}</span>
                  <span className="text-muted">{x.fila} na fila · {x.semAtendimento} sem vaga</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
