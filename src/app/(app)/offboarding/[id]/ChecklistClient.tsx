"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import { quandoBR } from "@/lib/format";
import { alternarItemChecklist, concluirOffboarding, salvarObsChecklist } from "@/app/actions/checklist";
import type { ChecklistItem } from "@/lib/types";

interface Props {
  colab: { id: string; nome: string; desligamento: string };
  itens: ChecklistItem[];
  termo: { arquivo: string; data: string } | null;
  /** Fila de origem do usuário: /fila-ti para o time de TI, /fila-rh para o RH. */
  filaHref: string;
}

export function ChecklistClient({ colab, itens: itensIniciais, termo, filaHref }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  // estado local: o clique marca NA HORA; o servidor grava em segundo plano
  const [itens, setItens] = useState<ChecklistItem[]>(itensIniciais);
  const [obsAberta, setObsAberta] = useState<string | null>(null);
  const [obsTmp, setObsTmp] = useState("");
  const [pending, start] = useTransition();

  // quando a sincronização automática recarrega a página, realinha com o servidor
  useEffect(() => setItens(itensIniciais), [itensIniciais]);

  const tudoFeito = itens.length > 0 && itens.every((i) => i.done);

  const toggle = (i: ChecklistItem) => {
    const otimista = itens.map((x) =>
      x.id === i.id
        ? x.done
          ? { ...x, done: false, por: null, quando: null }
          : { ...x, done: true, por: "Você", quando: new Date().toISOString() }
        : x
    );
    setItens(otimista);
    // sem router.refresh(): a resposta visual é imediata; se o servidor
    // recusar, o item volta ao estado anterior
    void alternarItemChecklist(i.id).then((r) => {
      if (!r.ok) {
        setItens(itens);
        toast(r.msg || "Não foi possível salvar — tente de novo");
      }
    });
  };

  const salvarObs = (id: string) => {
    const valor = obsTmp.trim();
    setItens((ts) => ts.map((x) => (x.id === id ? { ...x, obs: valor || null } : x)));
    setObsAberta(null);
    void salvarObsChecklist(id, valor);
  };

  const semLink = (e: React.MouseEvent) => {
    e.preventDefault();
    toast("Arquivos reais chegam com a integração de documentos");
  };

  const coluna = (lista: "rh" | "ti", label: string, doc: Props["termo"]) => {
    const doGrupo = itens.filter((i) => i.lista === lista);
    const done = doGrupo.filter((i) => i.done).length;
    const pct = doGrupo.length ? Math.round((done / doGrupo.length) * 100) : 0;
    return (
      <div className="card" style={{ gap: "var(--space-2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span className="card-title">{label}</span>
          <span className="text-muted" style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
            {done} de {doGrupo.length}
          </span>
        </div>
        <div style={{ height: 3, background: "var(--color-neutral-200)" }}>
          <div style={{ height: 3, width: `${pct}%`, background: "var(--ok)" }} />
        </div>
        {doc && (
          <div
            className="blueprint"
            style={{
              padding: 12,
              display: "flex",
              alignItems: "center",
              gap: 12,
              background: "var(--color-bg)",
              marginTop: 6,
            }}
          >
            <span
              style={{
                width: 40,
                height: 50,
                flex: "none",
                display: "grid",
                placeItems: "center",
                border: "1px solid var(--color-divider)",
                fontFamily: "var(--mono)",
                fontSize: 10,
                color: "var(--color-neutral-600)",
              }}
            >
              PDF
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 12,
                  fontFamily: "var(--mono)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {doc.arquivo}
              </div>
              <div className="text-muted" style={{ fontSize: 11 }}>
                termo de equipamentos · assinado em {doc.data}
              </div>
            </div>
            <a href="#" onClick={semLink} style={{ fontSize: 13, whiteSpace: "nowrap" }}>
              Abrir PDF ↗
            </a>
          </div>
        )}
        {doGrupo.map((i) => (
          <div key={i.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--color-divider)" }}>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={i.done}
                onChange={() => toggle(i)}
                style={{ accentColor: "var(--ok)", width: 15, height: 15, marginTop: 2 }}
              />
              <span
                style={{
                  flex: 1,
                  textDecoration: i.done ? "line-through" : "none",
                  color: i.done ? "var(--color-neutral-500)" : "inherit",
                }}
              >
                {i.titulo}
              </span>
            </label>
            {i.done && i.por && (
              <div className="text-muted" style={{ fontSize: 11, fontFamily: "var(--mono)", margin: "3px 0 0 25px" }}>
                concluído por {i.por} em {quandoBR(i.quando)}
              </div>
            )}
            {i.obs && obsAberta !== i.id && (
              <div
                style={{
                  fontSize: 12,
                  margin: "3px 0 0 25px",
                  borderLeft: "2px solid var(--color-divider)",
                  paddingLeft: 8,
                }}
              >
                {i.obs}
              </div>
            )}
            {obsAberta === i.id && (
              <input
                className="input"
                autoFocus
                style={{ margin: "6px 0 0 25px", width: "calc(100% - 25px)", fontSize: 13 }}
                placeholder="Observação (opcional)"
                value={obsTmp}
                onChange={(e) => setObsTmp(e.target.value)}
                onBlur={() => salvarObs(i.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") salvarObs(i.id);
                }}
              />
            )}
            {!i.obs && obsAberta !== i.id && !i.done && (
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setObsAberta(i.id);
                  setObsTmp(i.obs ?? "");
                }}
                style={{ fontSize: 11, padding: "2px 4px", marginLeft: 21 }}
              >
                + observação
              </button>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h6 className="text-muted" style={{ margin: 0 }}>Offboarding</h6>
          <h2 style={{ margin: 0 }}>Checklist · {colab.nome}</h2>
          <div className="text-muted" style={{ fontSize: 13 }}>
            Desligamento em {colab.desligamento} · <Link href={`/colaboradores/${colab.id}`}>ver perfil</Link>
          </div>
        </div>
        <Link href={filaHref} className="btn btn-secondary" style={{ flex: "none" }}>
          ← Voltar à fila
        </Link>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "var(--space-4)",
          alignItems: "start",
        }}
      >
        {coluna("rh", "RH", null)}
        {coluna("ti", "TI", termo)}
      </div>
      {tudoFeito && (
        <div className="card" style={{ gap: "var(--space-2)", borderColor: "var(--ok)" }}>
          <span className="card-title" style={{ color: "var(--ok-forte)" }}>
            Checklist completo
          </span>
          <span style={{ fontSize: 14 }}>
            Todos os itens de RH e TI foram concluídos. Concluir encerra o chamado de desligamento e registra o
            offboarding no perfil.
          </span>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn btn-secondary" onClick={() => router.push("/fila-ti")}>
              Voltar à fila
            </button>
            <button
              className="btn btn-primary"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await concluirOffboarding(colab.id);
                  toast(res.msg);
                  if (res.ok) router.push(`/colaboradores/${colab.id}`);
                })
              }
            >
              Concluir offboarding
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
