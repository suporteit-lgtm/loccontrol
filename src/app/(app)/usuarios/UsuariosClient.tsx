"use client";

import { useMemo, useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { quandoBR } from "@/lib/format";
import { CampoSenha } from "@/components/CampoSenha";
import {
  aprovarUsuario,
  criarUsuario,
  definirSenha,
  mudarPapel,
  removerUsuario,
  salvarUnidadesAcesso,
} from "@/app/actions/usuarios";
import type { Papel, UnidadesMap, Usuario } from "@/lib/types";

const AV_CORES = ["var(--color-accent)", "var(--ok)", "#8a5cd6", "#c2543a", "#2e7d8a"];

type UsuarioLista = Usuario & { temSenha: boolean };

const PAPEIS_FILTRO = ["Todos", "Superadmin", "Admin RH", "Admin T.I", "Usuário T.I", "Usuário RH"];

function CustomSelect({ value, onChange, options, disabled, pending }: { value: string, onChange: (v: string) => void, options: string[], disabled?: boolean, pending?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block", width: "100%", maxWidth: 200 }}>
      <button
        onClick={() => !disabled && !pending && setOpen(!open)}
        className="input hover-lift"
        disabled={disabled || pending}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
          fontSize: 13, padding: "6px 12px", width: "100%", minHeight: 33,
          borderRadius: 8, background: "var(--color-surface)", border: "1px solid var(--color-divider)",
          cursor: disabled || pending ? "not-allowed" : "pointer", fontWeight: 600, boxShadow: "var(--shadow-sm)",
          color: "var(--color-text)", textAlign: "left", opacity: pending ? 0.7 : 1
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5, flex: "none", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}><polyline points="6 9 12 15 18 9"></polyline></svg>
      </button>
      
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, width: "100%", zIndex: 50,
          background: "var(--color-surface)", border: "1px solid var(--color-divider)", borderRadius: 8,
          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.2)",
          padding: 4, display: "flex", flexDirection: "column", gap: 2, minWidth: "100%"
        }}>
          {options.map(opt => (
            <button
              key={opt}
              onClick={() => { onChange(opt); setOpen(false); }}
              style={{
                textAlign: "left", padding: "8px 12px", fontSize: 13, fontWeight: value === opt ? 700 : 500,
                background: value === opt ? "var(--color-bg)" : "transparent",
                color: "var(--color-text)",
                border: "none", borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between",
                transition: "background 0.1s"
              }}
              onMouseEnter={(e) => { if(value !== opt) e.currentTarget.style.background = "var(--color-bg-hover)" }}
              onMouseLeave={(e) => { if(value !== opt) e.currentTarget.style.background = "transparent" }}
            >
              {opt}
              {value === opt && <span style={{ color: "var(--color-accent)", fontSize: 12 }}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


export function UsuariosClient({
  usuarios,
  admin,
  podeSenha,
  unidadesMap,
}: {
  usuarios: UsuarioLista[];
  admin: boolean;
  podeSenha: boolean;
  unidadesMap: UnidadesMap;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [selecao, setSelecao] = useState<Record<string, boolean>>({});
  const [criando, setCriando] = useState(false);
  const [novo, setNovo] = useState({ nome: "", email: "", papel: "Usuário RH" as Papel, senha: "" });
  const [novoUnidades, setNovoUnidades] = useState<Record<string, boolean>>({});
  const [fPapel, setFPapel] = useState("Todos");
  const [senhaDe, setSenhaDe] = useState<UsuarioLista | null>(null);
  const [novaSenha, setNovaSenha] = useState("");
  const [pending, start] = useTransition();

  const lista = useMemo(() => {
    const q = busca.toLowerCase();
    return usuarios
      .filter(
        (u) =>
          (!q || (u.nome + u.email).toLowerCase().includes(q)) &&
          (fPapel === "Todos" || u.papel === fPapel)
      )
      .slice()
      .sort((a, b) => (a.status === "pendente" ? 0 : 1) - (b.status === "pendente" ? 0 : 1));
  }, [usuarios, busca, fPapel]);

  const pendentes = usuarios.filter((u) => u.status === "pendente").length;

  const acao = (fn: () => Promise<{ ok: boolean; msg: string }>) =>
    start(async () => {
      const res = await fn();
      toast(res.msg);
      router.refresh();
    });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, width: "100%" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 24, flexWrap: "wrap" }}>
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
          <h1 style={{ margin: "0 0 16px 0", fontSize: 32, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1 }}>Usuários</h1>
          
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
            <div>
              <div style={{ fontSize: 13, color: "var(--color-text)", fontWeight: 500, lineHeight: 1.5 }}>
                {admin
                  ? "Novos acessos via Google requerem aprovação (clique no status Pendente para aprovar)."
                  : "Modo visualização — somente admins (T.I, RH ou Superadmin) gerenciam acessos."}
              </div>
              <div style={{ fontSize: 12, fontFamily: "var(--mono)", color: "color-mix(in srgb, var(--color-text) 60%, transparent)", marginTop: 4 }}>
                O e-mail <strong style={{ color: "var(--color-text)", fontWeight: 600 }}>suporte.it@locgrupo.com.br</strong> é o superadmin permanente do sistema.
              </div>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
          {admin && (
            <button
              style={{ 
                display: "flex", alignItems: "center", gap: 8,
                padding: "10px 20px", borderRadius: 10, fontWeight: 600, fontSize: 14,
                background: "linear-gradient(180deg, var(--color-accent-300) 0%, var(--color-accent) 100%)",
                color: "#FFF",
                border: "1px solid color-mix(in srgb, var(--color-accent-600) 50%, transparent)",
                boxShadow: "0 2px 4px color-mix(in srgb, var(--color-accent) 20%, transparent), inset 0 1px 1px color-mix(in srgb, #FFF 30%, transparent)",
                cursor: "pointer",
                transition: "all 0.2s ease"
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 4px 12px color-mix(in srgb, var(--color-accent) 30%, transparent), inset 0 1px 1px color-mix(in srgb, #FFF 30%, transparent)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 2px 4px color-mix(in srgb, var(--color-accent) 20%, transparent), inset 0 1px 1px color-mix(in srgb, #FFF 30%, transparent)"; }}
              onClick={() => {
                setNovo({ nome: "", email: "", papel: "Usuário RH", senha: "" });
                setNovoUnidades({});
                setCriando(true);
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Novo usuário
            </button>
          )}
          
          <div style={{ 
            display: "flex", alignItems: "center", gap: 8, 
            padding: "8px 14px", borderRadius: 999,
            background: "color-mix(in srgb, var(--color-text) 3%, transparent)",
            border: "1px solid color-mix(in srgb, var(--color-text) 8%, transparent)",
          }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--ok)", boxShadow: "0 0 8px var(--ok)" }}></div>
            <span style={{ fontSize: 13, fontWeight: 500, color: "color-mix(in srgb, var(--color-text) 70%, transparent)", letterSpacing: "0.01em" }}>
              <strong style={{ color: "var(--color-text)", fontWeight: 700 }}>{usuarios.length}</strong> registrados
            </span>
          </div>

          {pendentes > 0 && (
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: "0.02em",
                padding: "6px 12px",
                borderRadius: 999,
                border: "1px solid color-mix(in srgb, var(--warn) 40%, transparent)",
                background: "color-mix(in srgb, var(--warn) 10%, transparent)",
                color: "var(--warn-forte)",
                display: "flex",
                alignItems: "center",
                gap: 6
              }}
            >
              <span style={{ fontSize: 14 }}>⚠️</span> {pendentes} aguardando aprovação
            </span>
          )}
        </div>
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 24 }}>
        <div style={{ position: "relative", width: "100%", maxWidth: 360 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", opacity: 0.5 }}>
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            className="input"
            style={{ width: "100%", paddingLeft: 40, borderRadius: 999 }}
            placeholder="Pesquisar por nome ou e-mail..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <div style={{ 
          display: "flex", gap: 8, background: "color-mix(in srgb, var(--color-bg-hover) 50%, transparent)", 
          padding: 6, borderRadius: 999, border: "1px solid var(--color-divider)",
          overflowX: "auto"
        }}>
          {PAPEIS_FILTRO.map((p) => {
            const sel = fPapel === p;
            return (
              <button
                key={p}
                onClick={() => setFPapel(p)}
                style={{
                  fontSize: 13,
                  fontWeight: sel ? 600 : 500,
                  padding: "6px 16px",
                  borderRadius: 999,
                  border: "none",
                  transition: "all 0.2s",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  color: sel ? "var(--color-bg)" : "var(--color-text)",
                  background: sel ? "var(--color-text)" : "transparent",
                  opacity: sel ? 1 : 0.7,
                }}
                onMouseEnter={(e) => { if (!sel) e.currentTarget.style.opacity = "1" }}
                onMouseLeave={(e) => { if (!sel) e.currentTarget.style.opacity = "0.7" }}
              >
                {p}
              </button>
            );
          })}
        </div>
      </div>
      <div
        style={{
          overflowX: "auto",
          border: "1px solid var(--color-divider)",
          borderRadius: 16,
          background: "var(--color-surface)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <table className="table" style={{ minWidth: 820 }}>
          <thead>
            <tr>
              <th>Usuário</th>
              <th>E-mail</th>
              <th>Status</th>
              <th>Papel</th>
              <th>Unidades</th>
              <th>Último acesso</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {lista.map((u) => (
              <tr key={u.id} style={{ height: 46 }}>
                <td style={{ padding: "12px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span
                      style={{
                        width: 34,
                        height: 34,
                        flex: "none",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: "50%",
                        background: AV_CORES[u.nome.length % AV_CORES.length],
                        color: "#fff",
                        fontFamily: "var(--font-heading)",
                        fontWeight: 700,
                        fontSize: 14,
                        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.2), 0 2px 4px rgba(0,0,0,0.1)",
                        textTransform: "uppercase"
                      }}
                    >
                      {u.nome.charAt(0)}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap" }}>{u.nome}</span>
                  </div>
                </td>
                <td style={{ fontFamily: "var(--mono)", fontSize: 13, color: "#FFF", fontWeight: 500 }}>
                  {u.email}
                </td>
                <td>
                  {u.status === "pendente" ? (
                    admin ? (
                      <button
                        onClick={() => acao(() => aprovarUsuario(u.id))}
                        disabled={pending}
                        title="Clique para aprovar o acesso"
                        style={{
                          cursor: "pointer",
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "4px 12px",
                          borderRadius: 999,
                          border: "1px solid color-mix(in srgb, var(--warn) 40%, transparent)",
                          background: "color-mix(in srgb, var(--warn) 15%, transparent)",
                          color: "var(--warn)",
                          transition: "all 0.2s"
                        }}
                      >
                        Pendente (Aprovar)
                      </button>
                    ) : (
                      <span
                        style={{
                          display: "inline-block",
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "4px 12px",
                          borderRadius: 999,
                          border: "1px solid color-mix(in srgb, var(--warn) 40%, transparent)",
                          background: "color-mix(in srgb, var(--warn) 10%, transparent)",
                          color: "var(--warn-forte)",
                        }}
                      >
                        Pendente
                      </span>
                    )
                  ) : (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "4px 12px",
                        borderRadius: 999,
                        border: "1px solid color-mix(in srgb, var(--ok) 30%, transparent)",
                        background: "color-mix(in srgb, var(--ok) 10%, transparent)",
                        color: "var(--ok)",
                      }}
                    >
                      <span style={{ opacity: 0.8 }}>✓</span> Aprovado
                    </span>
                  )}
                </td>
                <td>
                  {u.superadmin ? (
                    <span
                      title="Superadmin permanente · nunca perde o acesso"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "6px 12px",
                        height: 33, // Ensures same height as the select visually
                        borderRadius: 8,
                        border: "1px solid color-mix(in srgb, var(--danger) 40%, transparent)",
                        background: "color-mix(in srgb, var(--danger) 10%, transparent)",
                        color: "var(--danger)",
                      }}
                    >
                      SUPERADMIN
                    </span>
                  ) : admin ? (
                    <CustomSelect
                      value={u.papel}
                      options={["Admin RH", "Admin T.I", "Usuário T.I", "Usuário RH"]}
                      onChange={(v) => acao(() => mudarPapel(u.id, v as Papel))}
                      pending={pending}
                    />
                  ) : (
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{u.papel}</span>
                  )}
                </td>
                <td>
                  {u.superadmin ? (
                    <span className="text-muted" style={{ fontSize: 12 }}>
                      Todas
                    </span>
                  ) : admin ? (
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: 12, padding: "3px 10px" }}
                      onClick={() => {
                        setEditando(u);
                        setSelecao(
                          Object.fromEntries((u.unidades_acesso ?? []).map((k) => [k, true]))
                        );
                      }}
                    >
                      {(u.unidades_acesso ?? []).length
                        ? `${u.unidades_acesso.length} unidade(s)`
                        : "Todas"}
                    </button>
                  ) : (
                    <span style={{ fontSize: 12 }}>
                      {(u.unidades_acesso ?? []).length
                        ? `${u.unidades_acesso.length} unidade(s)`
                        : "Todas"}
                    </span>
                  )}
                </td>
                <td style={{ fontFamily: "var(--mono)", fontSize: 13, color: "#FFF", fontWeight: 500 }}>
                  {u.status === "pendente"
                    ? `solicitou em ${quandoBR(u.solicitado_em)}`
                    : quandoBR(u.ultimo_acesso)}
                </td>
                <td>
                  <div style={{ display: "flex", gap: 8, whiteSpace: "nowrap" }}>
                    {podeSenha && !u.superadmin && (
                      <button
                        title={u.temSenha ? "Redefinir a senha" : "Este usuário ainda não tem senha"}
                        onClick={() => {
                          setSenhaDe(u);
                          setNovaSenha("");
                        }}
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: "0.04em",
                          textTransform: "uppercase",
                          padding: "4px 12px",
                          borderRadius: 999,
                          cursor: "pointer",
                          background: u.temSenha 
                            ? "color-mix(in srgb, var(--color-accent) 15%, transparent)" 
                            : "color-mix(in srgb, var(--warn) 15%, transparent)",
                          color: u.temSenha ? "var(--color-accent-300)" : "var(--warn)",
                          border: `1px solid ${u.temSenha 
                            ? "color-mix(in srgb, var(--color-accent) 30%, transparent)" 
                            : "color-mix(in srgb, var(--warn) 30%, transparent)"}`,
                          transition: "all 0.2s ease"
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.filter = "brightness(1.2)"}
                        onMouseLeave={(e) => e.currentTarget.style.filter = "none"}
                      >
                        {u.temSenha ? "Senha" : "Definir senha"}
                      </button>
                    )}
                    {admin && !u.superadmin && (
                      <button
                        disabled={pending}
                        onClick={() => acao(() => removerUsuario(u.id))}
                        style={{ 
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: "0.04em",
                          textTransform: "uppercase",
                          padding: "4px 12px",
                          borderRadius: 999,
                          cursor: "pointer",
                          background: "color-mix(in srgb, var(--danger) 15%, transparent)",
                          color: "var(--danger)",
                          border: "1px solid color-mix(in srgb, var(--danger) 30%, transparent)",
                          transition: "all 0.2s ease",
                          opacity: pending ? 0.5 : 1
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.filter = "brightness(1.2)"}
                        onMouseLeave={(e) => e.currentTarget.style.filter = "none"}
                      >
                        Remover
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {criando && (
        <div className="dialog-backdrop">
          <div className="dialog" style={{ width: "min(560px, 100%)" }}>
            <span className="dialog-title">Novo usuário</span>
            <div className="dialog-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                <div className="field">
                  <label>Nome completo</label>
                  <input
                    className="input"
                    autoFocus
                    value={novo.nome}
                    onChange={(e) => setNovo((n) => ({ ...n, nome: e.target.value }))}
                  />
                </div>
                <div className="field">
                  <label>E-mail corporativo</label>
                  <input
                    className="input"
                    style={{ fontFamily: "var(--mono)" }}
                    placeholder="nome.sobrenome@locgrupo.com.br"
                    value={novo.email}
                    onChange={(e) => setNovo((n) => ({ ...n, email: e.target.value }))}
                  />
                </div>
                <div className="field">
                  <label>Papel</label>
                  <CustomSelect
                    value={novo.papel}
                    options={["Admin RH", "Admin T.I", "Usuário T.I", "Usuário RH"]}
                    onChange={(v) => setNovo((n) => ({ ...n, papel: v as Papel }))}
                    disabled={pending}
                  />
                </div>
                <div className="field">
                  <label>Senha inicial · mínimo 8 caracteres</label>
                  <CampoSenha value={novo.senha} onChange={(v) => setNovo((n) => ({ ...n, senha: v }))} />
                </div>
              </div>
              <div>
                <h6 className="text-muted" style={{ margin: "0 0 6px" }}>
                  Unidades que pode acessar · nenhuma marcada = todas
                </h6>
                <div style={{ maxHeight: "34vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
                  {Object.keys(unidadesMap)
                    .sort((a, b) => a.localeCompare(b))
                    .map((cidade) => (
                      <div key={cidade}>
                        <h6 className="text-muted" style={{ margin: "0 0 4px" }}>
                          {cidade}
                        </h6>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {(unidadesMap[cidade] ?? []).map((un) => {
                            const chave = `${cidade}|${un}`;
                            const sel = !!novoUnidades[chave];
                            return (
                              <button
                                key={chave}
                                onClick={() => setNovoUnidades((s) => ({ ...s, [chave]: !s[chave] }))}
                                className="btn"
                                style={{
                                  fontSize: 12,
                                  padding: "4px 12px",
                                  fontFamily: "var(--font-body)",
                                  border: `1px solid ${sel ? "var(--color-accent)" : "var(--color-divider)"}`,
                                  color: sel ? "var(--color-accent-700)" : "inherit",
                                  background: sel ? "var(--color-accent-100)" : "transparent",
                                  borderRadius: 999,
                                }}
                              >
                                {sel ? "✓ " : ""}
                                {un}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
              <span className="text-muted" style={{ fontSize: 12 }}>
                O usuário já entra aprovado. Enquanto o login for por papel (demonstração), ele acessa
                escolhendo o papel dele na tela de entrada; com o SSO Google, o acesso passa a ser pelo
                e-mail cadastrado aqui.
              </span>
            </div>
            <div className="dialog-actions">
              <button className="btn btn-secondary" onClick={() => setCriando(false)}>
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                disabled={pending || !novo.nome.trim() || !novo.email.includes("@") || novo.senha.length < 8}
                onClick={() =>
                  start(async () => {
                    const res = await criarUsuario({
                      ...novo,
                      unidades: Object.keys(novoUnidades).filter((k) => novoUnidades[k]),
                    });
                    toast(res.msg);
                    if (res.ok) {
                      setCriando(false);
                      router.refresh();
                    }
                  })
                }
              >
                {pending ? "Criando..." : "Criar usuário"}
              </button>
            </div>
          </div>
        </div>
      )}

      {senhaDe && (
        <div className="dialog-backdrop">
          <div className="dialog">
            <span className="dialog-title">
              {senhaDe.temSenha ? "Redefinir" : "Definir"} senha de {senhaDe.nome}
            </span>
            <div className="dialog-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="field">
                <label>Nova senha · mínimo 8 caracteres</label>
                <CampoSenha value={novaSenha} onChange={setNovaSenha} autoFocus />
              </div>
              <span className="text-muted" style={{ fontSize: 12 }}>
                Informe a nova senha ao usuário por um canal seguro. Ele usa o e-mail{" "}
                <span style={{ fontFamily: "var(--mono)" }}>{senhaDe.email}</span> para entrar.
              </span>
            </div>
            <div className="dialog-actions">
              <button className="btn btn-secondary" onClick={() => setSenhaDe(null)}>
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                disabled={pending || novaSenha.length < 8}
                onClick={() =>
                  start(async () => {
                    const res = await definirSenha(senhaDe.id, novaSenha);
                    toast(res.msg);
                    if (res.ok) {
                      setSenhaDe(null);
                      router.refresh();
                    }
                  })
                }
              >
                {pending ? "Salvando..." : "Salvar senha"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editando && (
        <div className="dialog-backdrop">
          <div className="dialog" style={{ width: "min(520px, 100%)" }}>
            <span className="dialog-title">Unidades de {editando.nome}</span>
            <div className="dialog-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <span>
                Marque as unidades que {editando.nome.split(" ")[0]} pode acessar.{" "}
                <strong>Nenhuma marcada = acesso a todas.</strong>
              </span>
              <div style={{ maxHeight: "46vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
                {Object.keys(unidadesMap)
                  .sort((a, b) => a.localeCompare(b))
                  .map((cidade) => (
                    <div key={cidade}>
                      <h6 className="text-muted" style={{ margin: "0 0 4px" }}>
                        {cidade}
                      </h6>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {(unidadesMap[cidade] ?? []).map((un) => {
                          const chave = `${cidade}|${un}`;
                          const sel = !!selecao[chave];
                          return (
                            <button
                              key={chave}
                              onClick={() => setSelecao((s) => ({ ...s, [chave]: !s[chave] }))}
                              className="btn"
                              style={{
                                fontSize: 12,
                                padding: "4px 12px",
                                fontFamily: "var(--font-body)",
                                border: `1px solid ${sel ? "var(--color-accent)" : "var(--color-divider)"}`,
                                color: sel ? "var(--color-accent-700)" : "inherit",
                                background: sel ? "var(--color-accent-100)" : "transparent",
                                borderRadius: 999,
                              }}
                            >
                              {sel ? "✓ " : ""}
                              {un}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
            <div className="dialog-actions">
              <button className="btn btn-ghost" onClick={() => setSelecao({})} style={{ marginRight: "auto", fontSize: 13 }}>
                Limpar (todas)
              </button>
              <button className="btn btn-secondary" onClick={() => setEditando(null)}>
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                disabled={pending}
                onClick={() => {
                  const lista = Object.keys(selecao).filter((k) => selecao[k]);
                  acao(() => salvarUnidadesAcesso(editando.id, lista));
                  setEditando(null);
                }}
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
