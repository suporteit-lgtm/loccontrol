"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { SelectCustom } from "@/components/SelectCustom";
import { useToast } from "@/components/Toast";
import { adicionarFeriado, atualizarFeriadosNacionais, removerFeriado } from "@/app/actions/escala";
import { dataLonga, horaSP, maiuscula } from "@/lib/escala/formato";
import type { FeriadoLinha } from "./page";

export function FeriadosClient({
  unidade,
  ano,
  anos,
  feriados,
  ultimaImportacao,
}: {
  unidade: string;
  ano: number;
  anos: number[];
  feriados: FeriadoLinha[];
  ultimaImportacao: { inicio: string; status: string; itens: number; erro: string | null } | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [data, setData] = useState("");
  const [nome, setNome] = useState("");
  const [semExp, setSemExp] = useState(false);
  const [remover, setRemover] = useState<string | null>(null);

  const exec = (fn: () => Promise<{ ok: boolean; msg: string }>, depois?: () => void) =>
    start(async () => {
      try {
        const r = await fn();
        toast(r.msg, r.ok ? "ok" : "erro");
        if (r.ok) depois?.();
        router.refresh();
      } catch (e) {
        toast((e as Error).message, "erro");
      }
    });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <PageHeader
        eyebrow="Escala de Presença"
        titulo="Feriados"
        sub={`${unidade} · nacionais pela BrasilAPI + municipais e dias sem expediente cadastrados aqui`}
        acoes={
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <SelectCustom className="input" style={{ minWidth: 110 }} value={String(ano)} options={anos.map(String)} onChange={(v) => router.push(`/escala-rh/feriados?ano=${v}`)} />
            <button className="btn btn-secondary" disabled={pending} onClick={() => exec(atualizarFeriadosNacionais)}>
              {pending ? "Atualizando..." : "Atualizar feriados nacionais"}
            </button>
          </div>
        }
      />

      {ultimaImportacao && (
        <p className="text-muted" style={{ fontSize: 12.5, margin: 0 }}>
          Última importação: {horaSP(ultimaImportacao.inicio)} ·{" "}
          {ultimaImportacao.status === "OK" ? `${ultimaImportacao.itens} novo(s)` : `erro: ${ultimaImportacao.erro}`} · automática todo 1º de
          dezembro, às 03:00, para o ano seguinte.
        </p>
      )}

      <section className="card elev-sm" style={{ gap: 10 }}>
        <div className="card-kicker">Cadastro manual</div>
        <div className="card-title" style={{ fontSize: 17 }}>Feriado municipal ou dia sem expediente</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input className="input" type="date" value={data} onChange={(e) => setData(e.target.value)} style={{ width: 170 }} />
          <input className="input" placeholder="Nome (ex.: Assunção de Nossa Senhora)" value={nome} onChange={(e) => setNome(e.target.value)} style={{ flex: 1, minWidth: 240 }} />
          <label className="radio">
            <input type="checkbox" checked={semExp} onChange={(e) => setSemExp(e.target.checked)} /> Dia sem expediente
          </label>
          <button
            className="btn btn-primary"
            disabled={pending || !data || !nome.trim()}
            onClick={() => exec(() => adicionarFeriado(data, nome, semExp), () => { setData(""); setNome(""); setSemExp(false); })}
          >
            Cadastrar
          </button>
        </div>
        <p className="text-muted" style={{ fontSize: 12.5, margin: 0 }}>
          Ao cadastrar ou remover, a escala dos dias futuros é recalculada. Reservas e posições na fila do dia ficam canceladas e as
          pessoas afetadas são avisadas por e-mail (conforme o modo de envio).
        </p>
      </section>

      <section className="card elev-sm" style={{ gap: 6 }}>
        <div className="card-kicker">{ano}</div>
        <div className="card-title" style={{ fontSize: 17 }}>{feriados.length} data(s)</div>
        {feriados.length === 0 ? (
          <p className="text-muted" style={{ fontSize: 13.5, margin: 0 }}>
            Nenhum feriado em {ano}. Use “Atualizar feriados nacionais” para importar.
          </p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Nome</th>
                <th>Origem</th>
                <th style={{ width: 1 }} />
              </tr>
            </thead>
            <tbody>
              {feriados.map((f) => (
                <tr key={f.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{maiuscula(dataLonga(f.data))}</td>
                  <td>
                    {f.nome}
                    {f.sem_expediente && <span className="tag tag-neutral" style={{ marginLeft: 8, fontSize: 10 }}>sem expediente</span>}
                  </td>
                  <td>
                    {f.origem === "NACIONAL_API" ? (
                      <span className="tag tag-accent" style={{ fontSize: 11 }}>Nacional automático</span>
                    ) : (
                      <span className="tag tag-neutral" style={{ fontSize: 11 }}>Manual{f.criado_por ? ` · ${f.criado_por}` : ""}</span>
                    )}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {f.origem === "MANUAL" &&
                      (remover === f.id ? (
                        <span style={{ display: "inline-flex", gap: 6 }}>
                          <button className="btn btn-danger" disabled={pending} onClick={() => exec(() => removerFeriado(f.id), () => setRemover(null))}>
                            Remover
                          </button>
                          <button className="btn btn-ghost" onClick={() => setRemover(null)}>Voltar</button>
                        </span>
                      ) : (
                        <button className="btn btn-ghost" style={{ color: "var(--danger)" }} onClick={() => setRemover(f.id)}>
                          Remover
                        </button>
                      ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
