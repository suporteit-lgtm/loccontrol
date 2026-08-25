"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { InputMascarado } from "@/components/Mascaras";
import {
  adicionarMembroGrupo,
  excluirOuSolicitarGrupo,
  removerMembrosGrupo,
  solicitarCriacaoGrupo,
} from "@/app/actions/grupos";

export interface GrupoView {
  nome: string;
  email: string;
  membros: { nome: string; email: string }[];
  reqExclusaoId: string | null;
}

export function GruposClient({
  grupos,
  reqCriacao,
  podeExcluirDireto,
  syncHora,
}: {
  grupos: GrupoView[];
  reqCriacao: { email: string; id: string }[];
  podeExcluirDireto: boolean;
  syncHora: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<string | null>(null);
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [addEmail, setAddEmail] = useState("");
  const [tipoReq, setTipoReq] = useState<"criacao" | "exclusao">("criacao");
  const [gNome, setGNome] = useState("");
  const [gEmail, setGEmail] = useState("");
  const [gExcluir, setGExcluir] = useState("");
  const [pending, start] = useTransition();

  const filtrados = useMemo(() => {
    const q = busca.toLowerCase();
    return grupos.filter((g) => !q || (g.nome + g.email).toLowerCase().includes(q));
  }, [grupos, busca]);

  const acao = (fn: () => Promise<{ ok: boolean; msg: string }>, aposOk?: () => void) =>
    start(async () => {
      const res = await fn();
      toast(res.msg);
      if (res.ok) {
        aposOk?.();
        router.refresh();
      }
    });

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
              Geral · espelho do Workspace
            </span>
          </div>
          <h1 style={{ margin: "0 0 16px 0", fontSize: 32, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1 }}>Grupos do Workspace</h1>
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
              Sincronizado automaticamente com o Google Workspace.
              <div style={{ color: "color-mix(in srgb, var(--color-text) 60%, transparent)", marginTop: 4 }}>
                Última verificação: <strong style={{ fontFamily: "var(--mono)", color: "var(--color-text)", fontWeight: 600 }}>{syncHora}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div style={{ position: "relative", width: "100%", maxWidth: 360 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", opacity: 0.5 }}>
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input
          className="input"
          style={{ width: "100%", paddingLeft: 40, borderRadius: 999 }}
          placeholder="Buscar grupo por nome ou e-mail..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {filtrados.map((g) => {
          const estaAberto = aberto === g.email;
          const nSel = g.membros.filter((m) => sel[g.email + "|" + m.email]).length;
          return (
            <div key={g.email} style={{ 
              display: "flex", flexDirection: "column",
              borderRadius: 16, overflow: "hidden",
              background: estaAberto ? "color-mix(in srgb, var(--color-surface) 80%, transparent)" : "color-mix(in srgb, var(--color-surface) 40%, transparent)", 
              border: `1px solid color-mix(in srgb, var(--color-text) ${estaAberto ? "15%" : "8%"}, transparent)`, 
              boxShadow: estaAberto ? "0 8px 32px color-mix(in srgb, #000 4%, transparent)" : "none",
              transition: "all 0.2s ease" 
            }}>
              <button
                onClick={() => {
                  setAberto(estaAberto ? null : g.email);
                  setSel({});
                  setAddEmail("");
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  padding: "16px 20px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  width: "100%",
                  color: "inherit",
                  fontFamily: "var(--font-body)",
                }}
                onMouseEnter={(e) => { if (!estaAberto) e.currentTarget.style.background = "color-mix(in srgb, var(--color-text) 2%, transparent)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontFamily: "var(--font-body)", fontWeight: 700, color: "var(--color-text)" }}>{g.nome}</div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 13, color: "color-mix(in srgb, var(--color-text) 60%, transparent)", marginTop: 2 }}>
                    {g.email}
                  </div>
                </div>
                {g.reqExclusaoId && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      padding: "4px 10px",
                      borderRadius: 999,
                      border: "1px solid color-mix(in srgb, var(--warn) 30%, transparent)",
                      background: "color-mix(in srgb, var(--warn) 15%, transparent)",
                      color: "var(--warn)",
                      flex: "none",
                    }}
                  >
                    Exclusão solicitada
                  </span>
                )}
                <span style={{ fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600, color: "color-mix(in srgb, var(--color-text) 50%, transparent)", flex: "none" }}>
                  {g.membros.length} {g.membros.length === 1 ? "membro" : "membros"}
                </span>
                <span style={{ 
                  color: "var(--color-text)", opacity: 0.3, transform: estaAberto ? "rotate(180deg)" : "none", transition: "transform 0.2s" 
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </span>
              </button>
              {estaAberto && (
                <div
                  style={{
                    borderTop: "1px solid color-mix(in srgb, var(--color-text) 8%, transparent)",
                    padding: "8px 20px 20px",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  {g.membros.map((m) => {
                    const k = g.email + "|" + m.email;
                    return (
                      <label
                        key={m.email}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 14,
                          padding: "10px 12px",
                          borderRadius: 8,
                          cursor: "pointer",
                          transition: "background 0.2s"
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "color-mix(in srgb, var(--color-text) 3%, transparent)"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                      >
                        <input
                          type="checkbox"
                          checked={!!sel[k]}
                          onChange={() => setSel((s) => ({ ...s, [k]: !s[k] }))}
                          style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
                        />
                        <div style={{
                          width: 20, height: 20, borderRadius: 6, flex: "none",
                          border: !!sel[k] ? "none" : "1px solid color-mix(in srgb, var(--color-text) 30%, transparent)",
                          background: !!sel[k] ? "var(--color-accent)" : "color-mix(in srgb, var(--color-surface) 50%, transparent)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          transition: "all 0.2s", boxShadow: !!sel[k] ? "0 2px 8px color-mix(in srgb, var(--color-accent) 40%, transparent)" : "none"
                        }}>
                          {!!sel[k] && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                        </div>
                        <span
                          style={{
                            width: 32,
                            height: 32,
                            flex: "none",
                            display: "grid",
                            placeItems: "center",
                            borderRadius: "50%",
                            background: "color-mix(in srgb, var(--color-accent) 15%, transparent)",
                            color: "var(--color-accent)",
                            fontFamily: "var(--font-body)",
                            fontWeight: 700,
                            fontSize: 13,
                          }}
                        >
                          {m.nome[0]}
                        </span>
                        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text)" }}>{m.nome}</span>
                          <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "color-mix(in srgb, var(--color-text) 50%, transparent)" }}>
                            {m.email}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                  {g.membros.length === 0 && (
                    <span className="text-muted" style={{ fontSize: 12, padding: "8px 0" }}>
                      Nenhum membro sincronizado neste grupo
                    </span>
                  )}
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", paddingTop: 16, marginTop: 8, borderTop: "1px solid color-mix(in srgb, var(--color-text) 8%, transparent)" }}>
                    <InputMascarado
                      tipo="email"
                      className="input-no-outline"
                      style={{ 
                        flex: 1, minWidth: 200, maxWidth: 320, fontSize: 13, padding: "10px 16px", borderRadius: 12,
                        background: "color-mix(in srgb, var(--color-surface) 60%, transparent)",
                        border: "1px solid color-mix(in srgb, var(--color-text) 15%, transparent)",
                        outline: "none", color: "var(--color-text)"
                      }}
                      placeholder="nome.sobrenome@locgrupo.com.br"
                      value={addEmail}
                      onChange={setAddEmail}
                    />
                    <button
                      disabled={pending || !addEmail}
                      style={{ 
                        fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase",
                        padding: "10px 20px", borderRadius: 12, cursor: !addEmail ? "not-allowed" : "pointer",
                        background: "color-mix(in srgb, var(--color-text) 8%, transparent)", color: "var(--color-text)",
                        border: "none", transition: "all 0.2s ease",
                        opacity: !addEmail || pending ? 0.4 : 1
                      }}
                      onMouseEnter={(e) => { if (addEmail) e.currentTarget.style.background = "color-mix(in srgb, var(--color-text) 12%, transparent)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "color-mix(in srgb, var(--color-text) 8%, transparent)"; }}
                      onClick={() => acao(() => adicionarMembroGrupo(g.email, addEmail), () => setAddEmail(""))}
                    >
                      Adicionar ao grupo
                    </button>
                    {nSel > 0 && (
                      <button
                        disabled={pending}
                        style={{ 
                          fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase",
                          padding: "10px 20px", borderRadius: 12, cursor: "pointer",
                          background: "color-mix(in srgb, var(--danger) 15%, transparent)", color: "var(--danger)",
                          border: "none", transition: "all 0.2s ease",
                          opacity: pending ? 0.5 : 1
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "color-mix(in srgb, var(--danger) 25%, transparent)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "color-mix(in srgb, var(--danger) 15%, transparent)"; }}
                        onClick={() =>
                          acao(
                            () =>
                              removerMembrosGrupo(
                                g.email,
                                g.membros.filter((m) => sel[g.email + "|" + m.email]).map((m) => m.email)
                              ),
                            () => setSel({})
                          )
                        }
                      >
                        Remover selecionados ({nSel})
                      </button>
                    )}
                    {!g.reqExclusaoId && (
                      <button
                        disabled={pending}
                        style={{ 
                          fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase",
                          padding: "10px 20px", borderRadius: 12, cursor: "pointer", marginLeft: "auto",
                          background: "color-mix(in srgb, var(--danger) 10%, transparent)", color: "var(--danger)",
                          border: "1px solid color-mix(in srgb, var(--danger) 20%, transparent)", transition: "all 0.2s ease",
                          opacity: pending ? 0.5 : 1
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "color-mix(in srgb, var(--danger) 15%, transparent)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "color-mix(in srgb, var(--danger) 10%, transparent)"; }}
                        onClick={() => acao(() => excluirOuSolicitarGrupo(g.email))}
                      >
                        {podeExcluirDireto ? "Excluir grupo" : "Solicitar exclusão"}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ 
        display: "flex", flexDirection: "column", gap: 16, padding: 24, borderRadius: 16, 
        background: "color-mix(in srgb, var(--color-surface) 60%, transparent)", 
        border: "1px solid color-mix(in srgb, var(--color-text) 5%, transparent)", 
        boxShadow: "0 8px 32px color-mix(in srgb, #000 3%, transparent)", marginTop: 12 
      }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0, letterSpacing: "-0.01em", color: "var(--color-text)" }}>Criar ou excluir grupos</h2>
          <div style={{ color: "color-mix(in srgb, var(--color-text) 60%, transparent)", fontSize: 13, marginTop: 4 }}>
            {podeExcluirDireto
              ? "Você tem permissão para excluir grupos diretamente. A criação de grupos abre um chamado para a TI."
              : "A criação e exclusão são executadas pela TI. Cada solicitação abrirá um chamado no sistema."}
          </div>
        </div>

        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", padding: "16px 0", borderBottom: "1px solid color-mix(in srgb, var(--color-text) 8%, transparent)" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
            <input 
              type="radio" name="gtipo" checked={tipoReq === "criacao"} onChange={() => setTipoReq("criacao")} 
              style={{ accentColor: "var(--color-accent)", width: 18, height: 18 }}
            />
            Criar novo grupo
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
            <input 
              type="radio" name="gtipo" checked={tipoReq === "exclusao"} onChange={() => setTipoReq("exclusao")} 
              style={{ accentColor: "var(--color-accent)", width: 18, height: 18 }}
            />
            Excluir grupo existente
          </label>
        </div>

        {tipoReq === "criacao" ? (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <input
              className="input"
              style={{ flex: 1, minWidth: 200, fontSize: 13, padding: "10px 16px", borderRadius: 12 }}
              placeholder="Nome do grupo (ex: Vendas SP)"
              value={gNome}
              onChange={(e) => setGNome(e.target.value)}
            />
            <InputMascarado
              tipo="email"
              style={{ flex: 1, minWidth: 240, fontSize: 13, padding: "10px 16px", borderRadius: 12 }}
              placeholder="grupo@locgrupo.com.br"
              value={gEmail}
              onChange={setGEmail}
            />
            <button
              disabled={pending || !gNome || !gEmail}
              style={{ 
                fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase",
                padding: "10px 20px", borderRadius: 12, cursor: (!gNome || !gEmail) ? "not-allowed" : "pointer",
                background: "color-mix(in srgb, var(--color-accent) 15%, transparent)", color: "var(--color-accent)",
                border: "1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)", transition: "all 0.2s ease",
                opacity: (!gNome || !gEmail) || pending ? 0.4 : 1
              }}
              onMouseEnter={(e) => { if (gNome && gEmail) e.currentTarget.style.filter = "brightness(1.2)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.filter = "none"; }}
              onClick={() =>
                acao(
                  () => solicitarCriacaoGrupo(gNome, gEmail),
                  () => {
                    setGNome("");
                    setGEmail("");
                  }
                )
              }
            >
              Solicitar à TI
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <select
              className="input"
              style={{ flex: 1, minWidth: 260, fontSize: 13, padding: "10px 16px", borderRadius: 12, fontFamily: "var(--mono)" }}
              value={gExcluir || grupos[0]?.email || ""}
              onChange={(e) => setGExcluir(e.target.value)}
            >
              {grupos.map((g) => (
                <option key={g.email} value={g.email}>
                  {g.email}
                </option>
              ))}
            </select>
            <button
              disabled={pending || grupos.length === 0}
              style={{ 
                fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase",
                padding: "10px 20px", borderRadius: 12, cursor: grupos.length === 0 ? "not-allowed" : "pointer",
                background: "color-mix(in srgb, var(--danger) 15%, transparent)", color: "var(--danger)",
                border: "1px solid color-mix(in srgb, var(--danger) 30%, transparent)", transition: "all 0.2s ease",
                opacity: grupos.length === 0 || pending ? 0.4 : 1
              }}
              onMouseEnter={(e) => { if (grupos.length > 0) e.currentTarget.style.filter = "brightness(1.2)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.filter = "none"; }}
              onClick={() => acao(() => excluirOuSolicitarGrupo(gExcluir || grupos[0]?.email || ""))}
            >
              {podeExcluirDireto ? "Excluir grupo" : "Solicitar à TI"}
            </button>
          </div>
        )}
        {reqCriacao.length > 0 && (
          <div style={{ fontSize: 12, color: "color-mix(in srgb, var(--color-text) 50%, transparent)", background: "color-mix(in srgb, var(--color-text) 4%, transparent)", padding: "12px 16px", borderRadius: 12, marginTop: 8 }}>
            <strong style={{ color: "var(--color-text)" }}>Solicitações aguardando TI:</strong>{" "}
            {reqCriacao.map((f) => <span key={f.id} style={{ fontFamily: "var(--mono)", marginLeft: 6 }}>{f.email}</span>)}
          </div>
        )}
      </div>
    </div>
  );
}
