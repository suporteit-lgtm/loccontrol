"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader, AvatarCircle, StatusPill } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { dataBR } from "@/lib/format";
import { importarColaboradores, exportarBasesParaDrive, excluirColaborador } from "@/app/actions/colaboradores";

interface Linha {
  id: string;
  nome: string;
  cpf: string | null;
  cargo: string | null;
  admissao: string | null;
  status: string | null;
  email: string | null;
  unidade: string | null;
  cidade: string | null;
  origem: string;
  suspenso: boolean;
}

const STATUS_OPTS = ["Todos", "A definir", "Pré-admissão", "Ativo", "Afastado", "Desligado"];

function baixar(nomeArq: string, conteudo: string) {
  const blob = new Blob(["﻿" + conteudo], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nomeArq;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function ColabsClient({
  unidadeAtual,
  colabs,
  statusInicial,
  nSemUnidade,
  soSemUnidade,
  todasAsBases,
  admin,
}: {
  unidadeAtual: string;
  colabs: Linha[];
  statusInicial: string;
  nSemUnidade: number;
  soSemUnidade: boolean;
  todasAsBases: boolean;
  admin: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busca, setBusca] = useState("");
  const [fStatus, setFStatus] = useState(statusInicial);
  const [fCargo, setFCargo] = useState("");
  const [fAdm, setFAdm] = useState("");
  const [admModo, setAdmModo] = useState<"dia" | "mes">("dia");
  const [fEmail, setFEmail] = useState("");
  const [exportando, setExportando] = useState(false);
  const [linkDrive, setLinkDrive] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState<Linha | null>(null);
  const [confirmaNome, setConfirmaNome] = useState("");
  const [, start] = useTransition();

  const filtrados = useMemo(() => {
    const q = busca.toLowerCase();
    const tem = (v: string | null, f: string) => !f || String(v ?? "").toLowerCase().includes(f.toLowerCase());
    return colabs.filter((c) => {
      const admBr = c.admissao ? dataBR(c.admissao) : "";
      const admOk = !fAdm || (admModo === "mes" ? admBr.slice(3).startsWith(fAdm) : admBr.startsWith(fAdm));
      const statusOk = !fStatus || (fStatus === "A definir" ? !c.status : c.status === fStatus);
      return (
        statusOk &&
        (!q || (c.nome + (c.cpf ?? "") + (c.email ?? "")).toLowerCase().includes(q)) &&
        tem(c.cargo, fCargo) &&
        admOk &&
        tem(c.email, fEmail)
      );
    });
  }, [colabs, busca, fStatus, fCargo, fAdm, admModo, fEmail]);

  const chips = STATUS_OPTS.map((st) => {
    const sel = st === "Todos" ? !fStatus : fStatus === st;
    return { label: st, sel, on: () => setFStatus(st === "Todos" ? "" : st) };
  });

  // Exporta TODAS as bases do sistema (todas as cidades/status) para o Drive,
  // em planilhas separadas por status — os contratos mudam entre elas.
  const exportar = () => {
    setExportando(true);
    setLinkDrive(null);
    start(async () => {
      const res = await exportarBasesParaDrive();
      setExportando(false);
      toast(res.msg);
      if (res.ok && res.link) setLinkDrive(res.link);
    });
  };

  const baixarCsvLocal = (e: React.MouseEvent) => {
    e.preventDefault();
    const linhas = [
      ["Nome", "CPF", "Cargo", "Admissão", "Status", "E-mail"].join(";"),
      ...filtrados.map((c) =>
        [c.nome, c.cpf ?? "", c.cargo ?? "", c.admissao ? dataBR(c.admissao) : "", c.status ?? "", c.email ?? ""].join(";")
      ),
    ];
    baixar("colaboradores.csv", linhas.join("\n"));
    toast(`${filtrados.length} colaborador(es) exportado(s) com o filtro atual`);
  };

  const baixarModelo = (e: React.MouseEvent) => {
    e.preventDefault();
    baixar(
      "modelo-colaboradores.csv",
      [
        "Nome;CPF;Cargo;Admissão;Status;E-mail",
        "Maria Silva Santos;123.456.789-00;Atendente de loja;01/09/2026;Pré-admissão;—",
      ].join("\n")
    );
    toast("Planilha modelo baixada");
  };

  const importarArquivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      const linhas = String(r.result)
        .replace(/^﻿/, "")
        .split(/\r?\n/)
        .filter((l) => l.trim());
      const novos = linhas.slice(1).map((l) => {
        const p = l.split(";").map((x) => x.trim());
        return { nome: p[0] ?? "", cpf: p[1] ?? "", cargo: p[2] ?? "", admissao: p[3] ?? "", status: p[4] ?? "", email: p[5] ?? "" };
      });
      start(async () => {
        const res = await importarColaboradores(novos);
        toast(res.msg);
        if (res.ok) router.refresh();
      });
      e.target.value = "";
    };
    r.readAsText(f);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <PageHeader
        eyebrow="Visão RH"
        titulo="Colaboradores"
        sub={`${unidadeAtual} · pessoas desta unidade`}
        acoes={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <a href="#" onClick={baixarModelo} style={{ fontSize: 12 }}>
              planilha modelo
            </a>
            <a href="#" onClick={baixarCsvLocal} style={{ fontSize: 12 }} title="Baixa um CSV só com a lista filtrada abaixo">
              baixar csv do filtro
            </a>
            <button className="btn btn-secondary" onClick={() => fileRef.current?.click()}>
              Importar
            </button>
            {linkDrive ? (
              <a
                href={linkDrive}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary"
                style={{ color: "var(--ok)", textDecoration: "none" }}
              >
                ✓ Abrir no Drive
              </a>
            ) : (
              <button
                className="btn btn-secondary"
                onClick={exportar}
                disabled={exportando}
                title="Exporta todas as bases (todos os status e cidades) em planilhas separadas no Drive"
              >
                {exportando ? "Exportando..." : "Exportar para o Drive"}
              </button>
            )}
            <Link href="/pre-admissao" className="btn btn-primary">
              + Nova pré-admissão
            </Link>
          </div>
        }
      />
      <input type="file" accept=".csv" style={{ display: "none" }} ref={fileRef} onChange={importarArquivo} />
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input
          className="input"
          style={{ maxWidth: 300 }}
          placeholder="Buscar por nome, CPF ou e-mail"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        {chips.map((c) => (
          <button
            key={c.label}
            onClick={c.on}
            className="btn"
            style={{
              fontSize: 12,
              padding: "4px 12px",
              fontFamily: "var(--font-body)",
              border: `1px solid ${c.sel ? "var(--color-accent)" : "var(--color-divider)"}`,
              color: c.sel ? "var(--color-accent-700)" : "inherit",
              background: c.sel ? "var(--color-accent-100)" : "transparent",
            }}
          >
            {c.label}
          </button>
        ))}
        {nSemUnidade > 0 && (
          <button
            onClick={() => router.push(soSemUnidade ? "/colaboradores" : "/colaboradores?semUnidade=1")}
            className="btn"
            title="Contas do Google Workspace ainda sem unidade definida — clique para ver só elas"
            style={{
              fontSize: 12,
              padding: "4px 12px",
              fontFamily: "var(--font-body)",
              border: `1px solid ${soSemUnidade ? "var(--warn)" : "var(--color-divider)"}`,
              color: "var(--warn-forte)",
              background: soSemUnidade ? "var(--warn-bg)" : "transparent",
            }}
          >
            {soSemUnidade ? "✓ " : ""}Sem unidade ({nSemUnidade})
          </button>
        )}
      </div>
      {filtrados.length > 0 ? (
        <div
          style={{
            overflowX: "auto",
            border: "1px solid var(--color-divider)",
            borderRadius: 10,
            background: "var(--color-surface)",
          }}
        >
          <table className="table" style={{ minWidth: 760 }}>
            <thead>
              <tr>
                <th>Nome</th>
                {todasAsBases && <th>Base</th>}
                <th>CPF</th>
                <th>Cargo</th>
                <th>Admissão</th>
                <th>Status</th>
                <th>E-mail corporativo</th>
                {admin && <th style={{ width: 32 }}></th>}
              </tr>
              <tr>
                <th style={{ padding: "4px 8px" }}></th>
                {todasAsBases && <th style={{ padding: "4px 8px" }}></th>}
                <th style={{ padding: "4px 8px" }}></th>
                <th style={{ padding: "4px 8px" }}>
                  <input
                    className="input"
                    style={{ width: "100%", fontSize: 12, padding: "4px 8px", fontWeight: 400, minHeight: 28, fontFamily: "var(--font-body)" }}
                    placeholder="Filtrar cargo"
                    value={fCargo}
                    onChange={(e) => setFCargo(e.target.value)}
                  />
                </th>
                <th style={{ padding: "4px 8px" }}>
                  <div style={{ display: "flex", gap: 4 }}>
                    <select
                      className="input"
                      style={{ fontSize: 11, padding: "4px 2px", width: 58, fontWeight: 400, minHeight: 28, fontFamily: "var(--font-body)" }}
                      value={admModo}
                      onChange={(e) => {
                        setAdmModo(e.target.value as "dia" | "mes");
                        setFAdm("");
                      }}
                    >
                      <option value="dia">Data</option>
                      <option value="mes">Mês</option>
                    </select>
                    <input
                      className="input"
                      style={{ flex: 1, minWidth: 74, fontSize: 12, padding: "4px 8px", fontWeight: 400, minHeight: 28, fontFamily: "var(--mono)" }}
                      placeholder={admModo === "mes" ? "mm/aaaa" : "dd/mm/aaaa"}
                      value={fAdm}
                      onChange={(e) => {
                        const d = e.target.value.replace(/\D/g, "");
                        let v: string;
                        if (admModo === "mes") {
                          v = d.slice(0, 6);
                          if (v.length > 2) v = v.slice(0, 2) + "/" + v.slice(2);
                        } else {
                          v = d.slice(0, 8);
                          if (v.length > 4) v = v.slice(0, 2) + "/" + v.slice(2, 4) + "/" + v.slice(4);
                          else if (v.length > 2) v = v.slice(0, 2) + "/" + v.slice(2);
                        }
                        setFAdm(v);
                      }}
                    />
                  </div>
                </th>
                <th style={{ padding: "4px 8px" }}>
                  <select
                    className="input"
                    style={{ width: "100%", fontSize: 12, padding: "4px 6px", fontWeight: 400, minHeight: 28, fontFamily: "var(--font-body)" }}
                    value={fStatus || "Todos"}
                    onChange={(e) => setFStatus(e.target.value === "Todos" ? "" : e.target.value)}
                  >
                    {STATUS_OPTS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </th>
                <th style={{ padding: "4px 8px" }}>
                  <input
                    className="input"
                    style={{ width: "100%", fontSize: 12, padding: "4px 8px", fontWeight: 400, minHeight: 28, fontFamily: "var(--mono)" }}
                    placeholder="@"
                    value={fEmail}
                    onChange={(e) => setFEmail(e.target.value)}
                  />
                </th>
                {admin && <th style={{ padding: "4px 8px" }}></th>}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((c) => {
                const falta = (
                  <span style={{ color: "var(--warn-forte)", fontStyle: "italic", whiteSpace: "nowrap" }}>
                    a preencher
                  </span>
                );
                return (
                  <tr
                    key={c.id}
                    onClick={() => router.push(`/colaboradores/${c.id}`)}
                    style={{ cursor: "pointer", height: 36 }}
                  >
                    <td style={{ fontSize: 14 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                        <AvatarCircle nome={c.nome} />
                        {c.nome}
                        {!c.unidade && (
                          <span
                            title="Conta do Google Workspace ainda sem unidade"
                            style={{
                              fontSize: 9,
                              textTransform: "uppercase",
                              letterSpacing: "0.06em",
                              padding: "1px 7px",
                              borderRadius: 999,
                              border: "1px solid var(--warn)",
                              color: "var(--warn-forte)",
                              background: "var(--warn-bg)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            sem unidade
                          </span>
                        )}
                        {c.suspenso && (
                          <span
                            title="Conta suspensa no Google Workspace"
                            style={{
                              fontSize: 9,
                              textTransform: "uppercase",
                              letterSpacing: "0.06em",
                              padding: "1px 7px",
                              borderRadius: 999,
                              background: "var(--color-neutral-300)",
                              color: "var(--color-neutral-800)",
                            }}
                          >
                            suspensa
                          </span>
                        )}
                      </span>
                    </td>
                    {todasAsBases && (
                      <td className="nowrap" style={{ fontSize: 12 }}>
                        {c.cidade ? `${c.cidade}${c.unidade ? ` · ${c.unidade}` : ""}` : "—"}
                      </td>
                    )}
                    <td className="nowrap" style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{c.cpf || falta}</td>
                    <td style={{ fontSize: 13 }}>{c.cargo || falta}</td>
                    <td className="nowrap" style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
                      {c.admissao ? dataBR(c.admissao) : falta}
                    </td>
                    <td className="nowrap">{c.status ? <StatusPill status={c.status} /> : falta}</td>
                    <td style={{ fontFamily: "var(--mono)", fontSize: 12 }} className="text-muted">
                      {c.email ?? "—"}
                    </td>
                    {admin && (
                      <td style={{ width: 32 }}>
                        <button
                          title={`Excluir ${c.nome} do LOCCONTROL`}
                          onClick={(e) => {
                            e.stopPropagation(); // não abrir o perfil ao clicar aqui
                            setConfirmaNome("");
                            setExcluindo(c);
                          }}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: "var(--danger-forte)",
                            fontSize: 13,
                            padding: 2,
                            lineHeight: 1,
                          }}
                        >
                          ✕
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card" style={{ alignItems: "center", padding: "var(--space-8)", gap: "var(--space-3)" }}>
          <span style={{ fontSize: 14 }}>
            Nenhum colaborador com esse filtro. Ajuste a busca ou importe do QuarkRH
          </span>
          <button
            className="btn btn-secondary"
            onClick={() => {
              setBusca("");
              setFStatus("");
              setFCargo("");
              setFAdm("");
              setFEmail("");
            }}
          >
            Limpar filtros
          </button>
        </div>
      )}

      {excluindo && (
        <div className="dialog-backdrop">
          <div className="dialog">
            <span className="dialog-title">Excluir {excluindo.nome}?</span>
            <div className="dialog-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <span>
                A ficha sai do LOCCONTROL junto com histórico, documentos e checklists. <strong>Não tem
                desfazer.</strong>
              </span>
              {excluindo.email && (
                <span
                  style={{
                    fontSize: 12.5,
                    border: "1px solid var(--warn)",
                    background: "var(--warn-bg)",
                    color: "var(--warn-forte)",
                    borderRadius: 8,
                    padding: "8px 10px",
                  }}
                >
                  A conta <span style={{ fontFamily: "var(--mono)" }}>{excluindo.email}</span> continua existindo no
                  Google Workspace — isto aqui não a apaga. Se ela permanecer lá, a ficha volta na próxima
                  sincronização. Para desligar alguém de verdade, use <strong>Desligar</strong> no perfil.
                </span>
              )}
              <div className="field">
                <label>Digite {excluindo.nome} para confirmar</label>
                <input
                  className="input"
                  autoFocus
                  value={confirmaNome}
                  onChange={(e) => setConfirmaNome(e.target.value)}
                />
              </div>
            </div>
            <div className="dialog-actions">
              <button className="btn btn-secondary" onClick={() => setExcluindo(null)}>
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                style={{ background: "var(--danger-forte)", borderColor: "var(--danger-forte)" }}
                disabled={confirmaNome.trim().toLowerCase() !== excluindo.nome.trim().toLowerCase()}
                onClick={() =>
                  start(async () => {
                    const res = await excluirColaborador(excluindo.id, confirmaNome);
                    toast(res.msg);
                    if (res.ok) {
                      setExcluindo(null);
                      router.refresh();
                    }
                  })
                }
              >
                Excluir definitivamente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
