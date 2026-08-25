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
    <div style={{ display: "flex", flexDirection: "column", gap: 24, width: "100%" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 24, flexWrap: "wrap", marginBottom: 8 }}>
        <div style={{ minWidth: 300 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ 
              fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", 
              padding: "4px 10px", borderRadius: 999, 
              background: "color-mix(in srgb, var(--color-accent) 15%, transparent)", 
              color: "var(--color-accent)", border: "1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)"
            }}>
              Visão TI
            </span>
          </div>
          <h1 style={{ margin: "0 0 16px 0", fontSize: 32, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1 }}>Unidades</h1>
          <div style={{ 
            display: "flex", gap: 12, alignItems: "flex-start",
            padding: 16, borderRadius: 12, 
            background: "color-mix(in srgb, var(--color-accent) 5%, transparent)",
            border: "1px solid color-mix(in srgb, var(--color-accent) 15%, transparent)",
            maxWidth: 680 
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", marginTop: 2 }}>
              <circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
            <div style={{ fontSize: 13, color: "var(--color-text)", fontWeight: 500, lineHeight: 1.5 }}>
              Cidades e unidades disponíveis no sistema.
              <div style={{ color: "color-mix(in srgb, var(--color-text) 60%, transparent)", marginTop: 4 }}>
                Criar ou remover exige aprovação de um admin (T.I, RH ou Superadmin).
              </div>
            </div>
          </div>
        </div>
      </div>

      {semGrupo.length > 0 && (
        <div style={{ 
          display: "flex", gap: 12, alignItems: "flex-start",
          padding: 16, borderRadius: 12, 
          background: "color-mix(in srgb, var(--warn) 10%, transparent)",
          border: "1px solid color-mix(in srgb, var(--warn) 30%, transparent)",
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--warn-forte)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", marginTop: 2 }}>
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
          <div style={{ fontSize: 13, color: "var(--color-text)", fontWeight: 500, lineHeight: 1.5 }}>
            <strong style={{ color: "var(--warn-forte)" }}>{semGrupo.length} unidade(s) sem grupo de e-mail:</strong>{" "}
            <span style={{ color: "color-mix(in srgb, var(--color-text) 80%, transparent)" }}>{semGrupo.map((k) => k.replace("|", " · ")).join(", ")}.</span>
            <div style={{ color: "color-mix(in srgb, var(--color-text) 60%, transparent)", marginTop: 4 }}>
              Nas admissões dessas bases, nenhum grupo é aplicado automaticamente.
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 24 }}>
        {cidades.map((cidade) => (
          <div key={cidade} className="card" style={{ display: "flex", flexDirection: "column", gap: 16, padding: 20, borderRadius: 16, background: "color-mix(in srgb, var(--color-surface) 60%, transparent)", border: "1px solid color-mix(in srgb, var(--color-text) 5%, transparent)", boxShadow: "0 8px 32px color-mix(in srgb, #000 3%, transparent)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
            <h2 style={{ fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: "-0.02em", color: "var(--color-text)" }}>{cidade}</h2>
            {pend("del-cidade", cidade) ? (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  padding: "4px 12px",
                  borderRadius: 999,
                  border: "1px solid color-mix(in srgb, var(--warn) 30%, transparent)",
                  background: "color-mix(in srgb, var(--warn) 15%, transparent)",
                  color: "var(--warn)",
                }}
              >
                Remoção solicitada · aguardando admin
              </span>
            ) : (
              <button
                disabled={pending}
                onClick={() => acao("del-cidade", cidade)}
                style={{ 
                  fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase",
                  padding: "6px 14px", borderRadius: 999, cursor: "pointer",
                  background: "color-mix(in srgb, var(--danger) 12%, transparent)", color: "var(--danger)",
                  border: "1px solid color-mix(in srgb, var(--danger) 25%, transparent)",
                  transition: "all 0.2s ease", opacity: pending ? 0.5 : 1
                }}
                onMouseEnter={(e) => { e.currentTarget.style.filter = "brightness(1.2)"; e.currentTarget.style.transform = "scale(0.98)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.filter = "none"; e.currentTarget.style.transform = "none"; }}
              >
                {admin ? "Remover cidade" : "Solicitar remoção"}
              </button>
            )}
          </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(mapa[cidade] ?? []).map((nome) => {
              const p = pend("del-unid", cidade, nome);
              const grupo = grupos[`${cidade}|${nome}`];
              return (
                <div
                  key={nome}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    fontSize: 13,
                    border: `1px solid ${grupo ? "color-mix(in srgb, var(--color-text) 8%, transparent)" : "color-mix(in srgb, var(--warn) 30%, transparent)"}`,
                    background: grupo ? "color-mix(in srgb, var(--color-text) 2%, transparent)" : "color-mix(in srgb, var(--warn) 10%, transparent)",
                    borderRadius: 12,
                    padding: "8px 16px",
                    flexWrap: "wrap",
                    transition: "all 0.2s ease"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = grupo ? "color-mix(in srgb, var(--color-text) 4%, transparent)" : "color-mix(in srgb, var(--warn) 15%, transparent)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = grupo ? "color-mix(in srgb, var(--color-text) 2%, transparent)" : "color-mix(in srgb, var(--warn) 10%, transparent)"}
                >
                  <strong style={{ color: "var(--color-text)", fontWeight: 700 }}>{nome}</strong>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        fontFamily: "var(--mono)",
                        fontSize: 12,
                        color: grupo ? "color-mix(in srgb, var(--color-text) 60%, transparent)" : "var(--warn-forte)",
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
                          background: "none", border: "none", cursor: "pointer",
                          color: "var(--color-accent)", fontSize: 11, fontWeight: 700, padding: 0, textTransform: "uppercase"
                        }}
                      >
                        editar
                      </button>
                    )}
                  </div>
                  {p ? (
                    <span
                      title="Remoção solicitada · aguardando admin"
                      style={{ 
                        fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
                        color: "var(--warn)", marginLeft: "auto", background: "color-mix(in srgb, var(--warn) 15%, transparent)", padding: "2px 8px", borderRadius: 999 
                      }}
                    >
                      Pendente
                    </span>
                  ) : (
                    <button
                      onClick={() => acao("del-unid", cidade, nome)}
                      title="Remover unidade"
                      disabled={pending}
                      style={{
                        background: "none", border: "none", cursor: "pointer",
                        color: "var(--color-text)", opacity: 0.4,
                        fontSize: 18, padding: "0 4px", marginLeft: "auto", transition: "opacity 0.2s"
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.color = "var(--danger)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.4"; e.currentTarget.style.color = "var(--color-text)"; }}
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}

            {admin && (
              <div style={{ display: "flex", gap: 12, marginTop: "auto", paddingTop: 8, alignItems: "center" }}>
                <input
                  className="input"
                  style={{ flex: 1, fontSize: 13, padding: "10px 16px", borderRadius: 12 }}
                  placeholder={`Nova unidade em ${cidade}`}
                  value={novas[cidade] ?? ""}
                  onChange={(e) => setNovas({ ...novas, [cidade]: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (novas[cidade] ?? "").trim()) {
                      acao("add-unid", cidade, (novas[cidade] ?? "").trim());
                      setNovas({ ...novas, [cidade]: "" });
                    }
                  }}
                />
                <button
                  disabled={pending || !(novas[cidade] ?? "").trim()}
                  onClick={() => {
                    acao("add-unid", cidade, (novas[cidade] ?? "").trim());
                    setNovas({ ...novas, [cidade]: "" });
                  }}
                  style={{ 
                    fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase",
                    padding: "10px 20px", borderRadius: 12, cursor: !(novas[cidade] ?? "").trim() ? "not-allowed" : "pointer",
                    background: "color-mix(in srgb, var(--color-text) 8%, transparent)", color: "var(--color-text)",
                    border: "none", transition: "all 0.2s ease",
                    opacity: !(novas[cidade] ?? "").trim() || pending ? 0.4 : 1
                  }}
                  onMouseEnter={(e) => { if ((novas[cidade] ?? "").trim()) e.currentTarget.style.background = "color-mix(in srgb, var(--color-text) 12%, transparent)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "color-mix(in srgb, var(--color-text) 8%, transparent)"; }}
                >
                  Adicionar
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
      </div>
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
