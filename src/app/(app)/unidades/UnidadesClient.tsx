"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { solicitarUnidade, definirGrupoUnidade } from "@/app/actions/unidades";

interface Props {
  mapa: Record<string, string[]>;
  pendencias: { acao: string; cidade: string; unidade?: string }[];
  admin: boolean;
  /** "Cidade|Unidade" → grupo do Workspace (null = a definir) */
  grupos: Record<string, string | null>;
}

export function UnidadesClient({ mapa, pendencias, admin, grupos }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [novas, setNovas] = useState<Record<string, string>>({});
  const [novaCidade, setNovaCidade] = useState("");
  const [editandoGrupo, setEditandoGrupo] = useState<{ cidade: string; unidade: string } | null>(null);
  const [grupoTmp, setGrupoTmp] = useState("");
  const [pending, start] = useTransition();

  const semGrupo = Object.entries(grupos).filter(([, v]) => !v).map(([k]) => k);

  const pend = (acao: string, cidade: string, unidade?: string) =>
    pendencias.some((p) => p.acao === acao && p.cidade === cidade && (p.unidade ?? "") === (unidade ?? ""));

  const acao = (a: "add-cidade" | "del-cidade" | "add-unid" | "del-unid", cidade: string, unidade?: string) =>
    start(async () => {
      const res = await solicitarUnidade(a, cidade, unidade);
      toast(res.msg);
      router.refresh();
    });

  const cidades = Object.keys(mapa).sort((a, b) => a.localeCompare(b));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", maxWidth: 720 }}>
      <PageHeader
        eyebrow="Visão TI"
        titulo="Unidades"
        sub="Cidades e unidades disponíveis no sistema · criar ou remover exige aprovação de um admin (T.I, RH ou Superadmin)"
      />
      {semGrupo.length > 0 && (
        <div
          style={{
            border: "1px solid var(--warn)",
            background: "var(--warn-bg)",
            color: "var(--warn-forte)",
            borderRadius: 10,
            padding: "10px 14px",
            fontSize: 13,
          }}
        >
          <strong>{semGrupo.length} unidade(s) sem grupo de e-mail definido:</strong>{" "}
          {semGrupo.map((k) => k.replace("|", " · ")).join(", ")}. Nas admissões dessas bases, nenhum grupo é
          aplicado automaticamente.
        </div>
      )}
      {cidades.map((cidade) => (
        <div key={cidade} className="card" style={{ gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span className="card-title">{cidade}</span>
            {pend("del-cidade", cidade) ? (
              <span
                style={{
                  fontSize: 10,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  padding: "3px 10px",
                  borderRadius: 999,
                  border: "1px solid var(--warn)",
                  background: "var(--warn-bg)",
                  color: "var(--warn-forte)",
                }}
              >
                Remoção solicitada · aguardando admin
              </span>
            ) : (
              <button
                className="btn btn-ghost"
                disabled={pending}
                onClick={() => acao("del-cidade", cidade)}
                style={{ fontSize: 12, color: "var(--danger-forte)" }}
              >
                {admin ? "Remover cidade" : "Solicitar remoção"}
              </button>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(mapa[cidade] ?? []).map((nome) => {
              const p = pend("del-unid", cidade, nome);
              const grupo = grupos[`${cidade}|${nome}`];
              return (
                <span
                  key={nome}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 12,
                    border: `1px solid ${grupo ? "var(--color-divider)" : "var(--warn)"}`,
                    background: grupo ? "transparent" : "var(--warn-bg)",
                    borderRadius: 999,
                    padding: "3px 10px",
                    flexWrap: "wrap",
                  }}
                >
                  {nome}
                  <span
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: 11,
                      color: grupo ? "var(--color-accent-700)" : "var(--warn-forte)",
                    }}
                  >
                    {grupo ?? "sem grupo definido"}
                  </span>
                  {admin && (
                    <button
                      onClick={() => {
                        setEditandoGrupo({ cidade, unidade: nome });
                        setGrupoTmp(grupo ?? "");
                      }}
                      title="Definir o grupo de e-mail desta unidade"
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--color-accent)",
                        fontSize: 11,
                        padding: 0,
                      }}
                    >
                      editar
                    </button>
                  )}
                  {p ? (
                    <span
                      title="Remoção solicitada · aguardando admin"
                      className="text-muted"
                      style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.05em" }}
                    >
                      pendente
                    </span>
                  ) : (
                    <button
                      onClick={() => acao("del-unid", cidade, nome)}
                      title="Remover unidade"
                      disabled={pending}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--danger-forte)",
                        fontSize: 12,
                        padding: 0,
                        lineHeight: 1,
                      }}
                    >
                      ✕
                    </button>
                  )}
                </span>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              className="input"
              style={{ maxWidth: 240, fontSize: 13 }}
              placeholder={`Nova unidade em ${cidade}`}
              value={novas[cidade] ?? ""}
              onChange={(e) => setNovas((n) => ({ ...n, [cidade]: e.target.value }))}
            />
            <button
              className="btn btn-secondary"
              disabled={pending}
              style={{ fontSize: 12 }}
              onClick={() => {
                const v = (novas[cidade] ?? "").trim();
                if (!v) return;
                setNovas((n) => ({ ...n, [cidade]: "" }));
                acao("add-unid", cidade, v);
              }}
            >
              {admin ? "Adicionar" : "Solicitar"}
            </button>
          </div>
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          className="input"
          style={{ maxWidth: 260 }}
          placeholder="Nova cidade (ex.: Curitiba)"
          value={novaCidade}
          onChange={(e) => setNovaCidade(e.target.value)}
        />
        <button
          className="btn btn-primary"
          disabled={pending}
          onClick={() => {
            const v = novaCidade.trim();
            if (!v) {
              toast("Informe o nome da cidade");
              return;
            }
            setNovaCidade("");
            acao("add-cidade", v);
          }}
        >
          {admin ? "Adicionar cidade" : "Solicitar cidade"}
        </button>
      </div>

      {editandoGrupo && (
        <div className="dialog-backdrop">
          <div className="dialog">
            <span className="dialog-title">
              Grupo de {editandoGrupo.cidade} · {editandoGrupo.unidade}
            </span>
            <div className="dialog-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="field">
                <label>Grupo do Workspace</label>
                <input
                  className="input"
                  autoFocus
                  style={{ fontFamily: "var(--mono)" }}
                  placeholder="unidade@locgrupo.com.br"
                  value={grupoTmp}
                  onChange={(e) => setGrupoTmp(e.target.value)}
                />
              </div>
              <span className="text-muted" style={{ fontSize: 12 }}>
                Toda pré-admissão desta base entra automaticamente neste grupo. Deixe em branco para remover.
              </span>
            </div>
            <div className="dialog-actions">
              <button className="btn btn-secondary" onClick={() => setEditandoGrupo(null)}>
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await definirGrupoUnidade(
                      editandoGrupo.cidade,
                      editandoGrupo.unidade,
                      grupoTmp
                    );
                    toast(res.msg);
                    if (res.ok) {
                      setEditandoGrupo(null);
                      router.refresh();
                    }
                  })
                }
              >
                {pending ? "Salvando..." : "Salvar grupo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
