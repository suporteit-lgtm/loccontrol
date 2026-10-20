"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import {
  alternarNotif,
  enviarNotifTeste,
  salvarTemplateChecklist,
  salvarEquipamentos,
  salvarModeloEmail,
  type ItemTemplate,
  type ItemEquipamento,
} from "@/app/actions/config";
import { trocarMinhaSenha } from "@/app/actions/usuarios";
import { CampoSenha } from "@/components/CampoSenha";

const CANAIS: [string, string, (email: string) => string][] = [
  ["email", "E-mail corporativo", (e) => `Alertas enviados para ${e}`],
  ["sistema", "No sistema", () => "Aviso no topo ao entrar no sistema"],
];

const EVENTOS: [string, string, string][] = [
  ["pre", "Nova pré-admissão", "Quando o RH cria ou importa uma pré-admissão"],
  ["chamado", "Chamado atribuído", "Quando um chamado é aberto para o seu time"],
  ["sla", "SLA a vencer", "Aviso 24h e 12h antes da data de admissão"],
  ["login", "Aprovação de login", "Novo usuário aguardando aprovação da TI"],
  ["grupos", "Grupos do Workspace", "Criação, exclusão e mudança de membros"],
];

function Toggle({ ativo, onClick }: { ativo: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      role="switch"
      aria-checked={ativo}
      style={{
        width: 44,
        height: 24,
        flex: "none",
        borderRadius: 999,
        background: ativo ? "var(--color-accent)" : "color-mix(in srgb, var(--color-text) 15%, transparent)",
        position: "relative",
        cursor: "pointer",
        transition: "background 0.3s ease",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 2,
          left: ativo ? 22 : 2,
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: "#fff",
          boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
          transition: "left 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
        }}
      />
    </div>
  );
}

export interface ModeloEmail {
  chave: string;
  assunto: string;
  corpo: string;
  anexo_nome: string | null;
}

const ROTULO_MODELO: Record<string, [string, string]> = {
  credenciais: ["Credenciais da conta", "Vai para o e-mail PESSOAL assim que a TI cria a conta: endereço corporativo e senha provisória."],
  "credenciais-externo": ["Credenciais (conta externa)", "Usado quando a TI marca \"e-mail criado em outro lugar\": mesmas credenciais, com o link do webmail em vez do Gmail."],
  "boas-vindas": ["Chamados (boas-vindas)", "Sai 5 min após o primeiro login, no corporativo. Explica como abrir chamados."],
  "acesso-quark": ["Acesso ao QuarkRH", "Sai junto com o de chamados, 5 min após o primeiro login. Criação da senha do portal."],
};

const cardStyle: React.CSSProperties = {
  display: "flex", flexDirection: "column", gap: 16,
  background: "color-mix(in srgb, var(--color-surface) 30%, transparent)",
  border: "1px solid color-mix(in srgb, var(--color-text) 5%, transparent)",
  borderRadius: 24, padding: 24,
  backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
};

const kickerStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "var(--color-accent)", textTransform: "uppercase", letterSpacing: "0.06em" };
const cardTitleStyle: React.CSSProperties = { fontSize: 20, fontWeight: 700, color: "var(--color-text)", margin: 0 };
const cardBodyStyle: React.CSSProperties = { fontSize: 13, color: "color-mix(in srgb, var(--color-text) 70%, transparent)", lineHeight: 1.5, margin: 0 };

const btnPrimaryStyle: React.CSSProperties = {
  background: "var(--color-accent)", color: "#fff", border: "none", borderRadius: 999,
  padding: "10px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer", alignSelf: "flex-start",
  transition: "opacity 0.2s"
};

const btnSecondaryStyle: React.CSSProperties = {
  background: "color-mix(in srgb, var(--color-text) 8%, transparent)", color: "var(--color-text)",
  border: "none", borderRadius: 999, padding: "10px 20px", fontSize: 13, fontWeight: 600,
  cursor: "pointer", alignSelf: "flex-start", transition: "background 0.2s"
};

const inputWrapperStyle: React.CSSProperties = {
  display: "flex", flexDirection: "column", gap: 6,
};

const labelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: "color-mix(in srgb, var(--color-text) 70%, transparent)"
};

export function ConfigClient({
  notif: notifInicial,
  email,
  workspaceOk,
  quarkOk,
  template,
  equipamentos,
  modelos,
  admin,
}: {
  notif: Record<string, boolean>;
  email: string;
  workspaceOk: boolean;
  quarkOk: boolean;
  template: ItemTemplate[];
  equipamentos: ItemEquipamento[];
  modelos: ModeloEmail[];
  admin: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [notif, setNotif] = useState(notifInicial);
  const [editandoTpl, setEditandoTpl] = useState(false);
  const [tpl, setTpl] = useState<ItemTemplate[]>(template);
  const [editandoEq, setEditandoEq] = useState(false);
  const [eqs, setEqs] = useState<ItemEquipamento[]>(equipamentos);
  const [editandoBv, setEditandoBv] = useState<ModeloEmail | null>(null);
  const [bv, setBv] = useState({ assunto: "", corpo: "" });
  const [senhaAtual, setSenhaAtual] = useState("");
  const [senhaNova, setSenhaNova] = useState("");
  const [pending, start] = useTransition();

  const nRh = template.filter((t) => t.lista === "rh").length;
  const nTi = template.filter((t) => t.lista === "ti").length;

  const colunaTpl = (lista: "rh" | "ti", rotulo: string) => (
    <div style={{ flex: 1, minWidth: 260, display: "flex", flexDirection: "column", gap: 8 }}>
      <h6 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>{rotulo}</h6>
      {tpl.map((item, i) =>
        item.lista !== lista ? null : (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              style={{ 
                flex: 1, fontSize: 13, padding: "10px 14px", borderRadius: 12,
                background: "color-mix(in srgb, var(--color-text) 5%, transparent)",
                border: "1px solid color-mix(in srgb, var(--color-text) 10%, transparent)",
                color: "var(--color-text)", outline: "none"
              }}
              value={item.titulo}
              onChange={(e) => setTpl((t) => t.map((x, j) => (j === i ? { ...x, titulo: e.target.value } : x)))}
            />
            <div
              title="Remover item"
              onClick={() => setTpl((t) => t.filter((_, j) => j !== i))}
              style={{
                background: "color-mix(in srgb, var(--danger) 15%, transparent)", color: "var(--danger)",
                width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", transition: "background 0.2s"
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </div>
          </div>
        )
      )}
      <button
        style={{ ...btnSecondaryStyle, background: "transparent", color: "var(--color-accent)", padding: "8px 0" }}
        onClick={() => setTpl((t) => [...t, { lista, titulo: "" }])}
      >
        + Adicionar item
      </button>
    </div>
  );

  const alternar = (k: string) => {
    setNotif((n) => ({ ...n, [k]: !n[k] }));
    start(() => alternarNotif(k).then(() => {}));
  };

  const linha = (k: string, label: string, desc: string) => (
    <div
      key={k}
      style={{
        display: "flex", alignItems: "center", gap: 16, padding: "12px 0",
        borderBottom: "1px solid color-mix(in srgb, var(--color-text) 5%, transparent)",
      }}
    >
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 12, color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>
          {desc}
        </div>
      </div>
      <Toggle ativo={!!notif[k]} onClick={() => alternar(k)} />
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32, width: "100%" }}>
      {/* HEADER */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "color-mix(in srgb, var(--color-text) 40%, transparent)" }}>
          Transversal
        </span>
        <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1 }}>
          Configurações
        </h1>
      </div>

      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
        {/* COLUNA ESQUERDA - SENHA E ALERTAS */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24, flex: 1, minWidth: 320, maxWidth: 500 }}>
          
          <div style={cardStyle}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={kickerStyle}>Conta</span>
              <h2 style={cardTitleStyle}>Minha senha</h2>
              <p style={cardBodyStyle}>Troque a sua senha de acesso. Só você pode alterá-la — para os demais, fale com o Admin T.I.</p>
            </div>
            
            <div style={inputWrapperStyle}>
              <label style={labelStyle}>Senha atual</label>
              <div style={{ padding: "4px", background: "color-mix(in srgb, var(--color-text) 5%, transparent)", borderRadius: 12, border: "1px solid color-mix(in srgb, var(--color-text) 10%, transparent)" }}>
                <CampoSenha value={senhaAtual} onChange={setSenhaAtual} autoComplete="current-password" />
              </div>
            </div>
            
            <div style={inputWrapperStyle}>
              <label style={labelStyle}>Nova senha · mínimo 8 caracteres</label>
              <div style={{ padding: "4px", background: "color-mix(in srgb, var(--color-text) 5%, transparent)", borderRadius: 12, border: "1px solid color-mix(in srgb, var(--color-text) 10%, transparent)" }}>
                <CampoSenha value={senhaNova} onChange={setSenhaNova} />
              </div>
            </div>
            
            <button
              style={{ ...btnPrimaryStyle, opacity: (pending || senhaNova.length < 8) ? 0.5 : 1 }}
              disabled={pending || senhaNova.length < 8}
              onClick={() =>
                start(async () => {
                  const res = await trocarMinhaSenha(senhaAtual, senhaNova);
                  toast(res.msg);
                  if (res.ok) {
                    setSenhaAtual("");
                    setSenhaNova("");
                  }
                })
              }
            >
              {pending ? "Salvando..." : "Alterar minha senha"}
            </button>
          </div>

          <div style={cardStyle}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={kickerStyle}>Alertas</span>
                <h2 style={cardTitleStyle}>Notificações</h2>
                <p style={cardBodyStyle}>O sistema avisa as pessoas certas quando algo precisa de ação.</p>
              </div>
              <button
                style={{ ...btnSecondaryStyle, padding: "8px 14px", fontSize: 12 }}
                onClick={() =>
                  start(async () => {
                    const res = await enviarNotifTeste();
                    toast(res.msg);
                  })
                }
              >
                Enviar teste
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", marginTop: 8 }}>
              <h6 style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: "color-mix(in srgb, var(--color-text) 40%, transparent)", textTransform: "uppercase" }}>Canais</h6>
              {CANAIS.map(([k, label, desc]) => linha(k, label, desc(email)))}
            </div>

            <div style={{ display: "flex", flexDirection: "column", marginTop: 8 }}>
              <h6 style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: "color-mix(in srgb, var(--color-text) 40%, transparent)", textTransform: "uppercase" }}>Eventos</h6>
              {EVENTOS.map(([k, label, desc]) => linha(k, label, desc))}
            </div>
          </div>
          
        </div>

        {/* COLUNA DIREITA - INTEGRAÇÕES E TEMPLATES */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 24, flex: 2, minWidth: 320 }}>
          
          <div style={cardStyle}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={kickerStyle}>Integração</span>
              <h2 style={cardTitleStyle}>QuarkRH</h2>
              <p style={cardBodyStyle}>Fonte dos dados de pré-admissão. Busca por CPF ou matrícula.</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 600, color: quarkOk ? "var(--ok)" : "var(--warn)", marginTop: "auto" }}>
              <div style={{ width: 8, height: 8, background: "currentColor", borderRadius: "50%", boxShadow: "0 0 8px currentColor" }} />
              {quarkOk ? "CONECTADO" : "PENDENTE"}
              <span style={{ color: "color-mix(in srgb, var(--color-text) 40%, transparent)", fontWeight: 500 }}>· api.quarkrh.com.br</span>
            </div>
          </div>

          <div style={cardStyle}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={kickerStyle}>Integração</span>
              <h2 style={cardTitleStyle}>Google Workspace</h2>
              <p style={cardBodyStyle}>Criação de contas, grupos e o bloqueio de emergência.</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 600, color: workspaceOk ? "var(--ok)" : "var(--warn)", marginTop: "auto" }}>
              <div style={{ width: 8, height: 8, background: "currentColor", borderRadius: "50%", boxShadow: "0 0 8px currentColor" }} />
              {workspaceOk ? "CONECTADO" : "PENDENTE"}
              <span style={{ color: "color-mix(in srgb, var(--color-text) 40%, transparent)", fontWeight: 500 }}>· locgrupo.com.br</span>
            </div>
          </div>

          <div style={{ ...cardStyle, gridColumn: "1 / -1" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={kickerStyle}>Alertas</span>
              <h2 style={cardTitleStyle}>Destinatários</h2>
              <p style={cardBodyStyle}>Recebem os alertas de 24h e 12h antes de cada admissão.</p>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <span style={{ fontFamily: "var(--mono)", fontSize: 12, background: "color-mix(in srgb, var(--color-text) 8%, transparent)", color: "var(--color-text)", padding: "6px 12px", borderRadius: 8, fontWeight: 500 }}>
                rh@locgrupo.com.br
              </span>
              <span style={{ fontFamily: "var(--mono)", fontSize: 12, background: "color-mix(in srgb, var(--color-text) 8%, transparent)", color: "var(--color-text)", padding: "6px 12px", borderRadius: 8, fontWeight: 500 }}>
                suporte.ti@locgrupo.com.br
              </span>
            </div>
          </div>

          <div style={{ ...cardStyle, gridColumn: "1 / -1" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={kickerStyle}>Templates</span>
              <h2 style={cardTitleStyle}>Checklist de offboarding</h2>
              <p style={cardBodyStyle}>{nRh} itens de RH e {nTi} de TI. Aplicado a cada novo desligamento.</p>
            </div>
            <button
              style={{ ...btnSecondaryStyle, marginTop: 8 }}
              onClick={() => {
                if (!admin) { toast("Somente administradores editam o template"); return; }
                setTpl(template); setEditandoTpl(true);
              }}
            >
              Editar template
            </button>
          </div>

          <div style={{ ...cardStyle, gridColumn: "1 / -1" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={kickerStyle}>Templates</span>
              <h2 style={cardTitleStyle}>Equipamentos</h2>
              <p style={cardBodyStyle}>{equipamentos.length} equipamento(s) no catálogo · {equipamentos.filter((e) => e.kit).length} no kit padrão pré-selecionado nas admissões.</p>
            </div>
            <button
              style={{ ...btnSecondaryStyle, marginTop: 8 }}
              onClick={() => {
                if (!admin) { toast("Somente administradores editam o catálogo"); return; }
                setEqs(equipamentos); setEditandoEq(true);
              }}
            >
              Editar catálogo
            </button>
          </div>

          {modelos.map((m) => {
            const [titulo, desc] = ROTULO_MODELO[m.chave] ?? [m.chave, "Modelo de e-mail automático."];
            return (
              <div style={cardStyle} key={m.chave}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={kickerStyle}>E-mails automáticos</span>
                  <h2 style={cardTitleStyle}>{titulo}</h2>
                  <p style={cardBodyStyle}>{desc}</p>
                </div>
                {m.anexo_nome && (
                  <span style={{ fontSize: 12, fontFamily: "var(--mono)", color: "var(--color-text)", opacity: 0.6 }}>
                    📎 {m.anexo_nome}
                  </span>
                )}
                <button
                  style={{ ...btnSecondaryStyle, marginTop: "auto" }}
                  onClick={() => {
                    if (!admin) { toast("Somente administradores editam o modelo"); return; }
                    setBv({ assunto: m.assunto, corpo: m.corpo });
                    setEditandoBv(m);
                  }}
                >
                  Editar modelo
                </button>
              </div>
            );
          })}

        </div>
      </div>

      {/* MODAL EMAIL */}
      {editandoBv && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}>
          <div style={{ width: "100%", maxWidth: 620, background: "var(--color-surface)", borderRadius: 24, border: "1px solid color-mix(in srgb, var(--color-text) 10%, transparent)", boxShadow: "0 24px 64px rgba(0,0,0,0.4)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "24px 32px", borderBottom: "1px solid color-mix(in srgb, var(--color-text) 5%, transparent)" }}>
              <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{(ROTULO_MODELO[editandoBv.chave] ?? [editandoBv.chave])[0]}</h3>
            </div>
            
            <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24 }}>
              <div style={{ fontSize: 13, color: "color-mix(in srgb, var(--color-text) 70%, transparent)", lineHeight: 1.5 }}>
                {(ROTULO_MODELO[editandoBv.chave] ?? ["", ""])[1]} Pode usar:{" "}
                <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--color-accent)", background: "color-mix(in srgb, var(--color-accent) 15%, transparent)", padding: "2px 6px", borderRadius: 6 }}>
                  {"{nome} {primeiro_nome} {email} {cargo} {unidade}"}
                  {editandoBv.chave === "credenciais" ? " {senha}" : ""}
                </span>
              </div>
              <div style={inputWrapperStyle}>
                <label style={labelStyle}>Assunto</label>
                <input 
                  style={{ width: "100%", fontSize: 14, padding: "12px 16px", borderRadius: 12, background: "color-mix(in srgb, var(--color-text) 5%, transparent)", border: "1px solid color-mix(in srgb, var(--color-text) 10%, transparent)", color: "var(--color-text)", outline: "none" }} 
                  value={bv.assunto} onChange={(e) => setBv((b) => ({ ...b, assunto: e.target.value }))} 
                />
              </div>
              <div style={inputWrapperStyle}>
                <label style={labelStyle}>Corpo</label>
                <textarea
                  style={{ width: "100%", resize: "vertical", fontSize: 13, lineHeight: 1.6, padding: "12px 16px", borderRadius: 12, background: "color-mix(in srgb, var(--color-text) 5%, transparent)", border: "1px solid color-mix(in srgb, var(--color-text) 10%, transparent)", color: "var(--color-text)", outline: "none" }}
                  rows={12}
                  value={bv.corpo}
                  onChange={(e) => setBv((b) => ({ ...b, corpo: e.target.value }))}
                />
              </div>
            </div>

            <div style={{ padding: "16px 32px", borderTop: "1px solid color-mix(in srgb, var(--color-text) 5%, transparent)", display: "flex", justifyContent: "flex-end", gap: 12, background: "color-mix(in srgb, var(--color-text) 2%, transparent)" }}>
              <button style={{ ...btnSecondaryStyle, background: "transparent" }} onClick={() => setEditandoBv(null)}>Cancelar</button>
              <button
                style={{ ...btnPrimaryStyle, opacity: pending ? 0.5 : 1 }}
                disabled={pending}
                onClick={() => start(async () => {
                  const res = await salvarModeloEmail(editandoBv.chave, bv.assunto, bv.corpo);
                  toast(res.msg);
                  if (res.ok) { setEditandoBv(null); router.refresh(); }
                })}
              >
                {pending ? "Salvando..." : "Salvar modelo"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EQUIPAMENTOS */}
      {editandoEq && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}>
          <div style={{ width: "100%", maxWidth: 540, background: "var(--color-surface)", borderRadius: 24, border: "1px solid color-mix(in srgb, var(--color-text) 10%, transparent)", boxShadow: "0 24px 64px rgba(0,0,0,0.4)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "24px 32px", borderBottom: "1px solid color-mix(in srgb, var(--color-text) 5%, transparent)" }}>
              <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Catálogo de equipamentos</h3>
            </div>
            
            <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24 }}>
              <span style={{ fontSize: 13, color: "color-mix(in srgb, var(--color-text) 70%, transparent)", lineHeight: 1.5 }}>
                A lista aparece no passo 2 da pré-admissão. Marque <strong>Kit</strong> no que deve vir pré-selecionado.
              </span>
              <div style={{ maxHeight: "46vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
                {eqs.map((item, i) => (
                  <div key={i} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <input
                      style={{ flex: 1, fontSize: 13, padding: "10px 14px", borderRadius: 12, background: "color-mix(in srgb, var(--color-text) 5%, transparent)", border: "1px solid color-mix(in srgb, var(--color-text) 10%, transparent)", color: "var(--color-text)", outline: "none" }}
                      value={item.nome}
                      onChange={(e) => setEqs((t) => t.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)))}
                    />
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
                      <input
                        type="checkbox"
                        checked={item.kit}
                        onChange={() => setEqs((t) => t.map((x, j) => (j === i ? { ...x, kit: !x.kit } : x)))}
                        style={{ accentColor: "var(--color-accent)", width: 16, height: 16 }}
                      />
                      Kit
                    </label>
                    <div
                      title="Remover"
                      onClick={() => setEqs((t) => t.filter((_, j) => j !== i))}
                      style={{ background: "color-mix(in srgb, var(--danger) 15%, transparent)", color: "var(--danger)", width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "background 0.2s" }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </div>
                  </div>
                ))}
                <button
                  style={{ ...btnSecondaryStyle, background: "transparent", color: "var(--color-accent)", padding: "8px 0" }}
                  onClick={() => setEqs((t) => [...t, { nome: "", kit: false }])}
                >
                  + Adicionar equipamento
                </button>
              </div>
            </div>
            <div style={{ padding: "16px 32px", borderTop: "1px solid color-mix(in srgb, var(--color-text) 5%, transparent)", display: "flex", justifyContent: "flex-end", gap: 12, background: "color-mix(in srgb, var(--color-text) 2%, transparent)" }}>
              <button style={{ ...btnSecondaryStyle, background: "transparent" }} onClick={() => setEditandoEq(false)}>Cancelar</button>
              <button
                style={{ ...btnPrimaryStyle, opacity: pending ? 0.5 : 1 }}
                disabled={pending}
                onClick={() => start(async () => {
                  const res = await salvarEquipamentos(eqs);
                  toast(res.msg);
                  if (res.ok) { setEditandoEq(false); router.refresh(); }
                })}
              >
                {pending ? "Salvando..." : "Salvar catálogo"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TEMPLATE */}
      {editandoTpl && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}>
          <div style={{ width: "100%", maxWidth: 720, background: "var(--color-surface)", borderRadius: 24, border: "1px solid color-mix(in srgb, var(--color-text) 10%, transparent)", boxShadow: "0 24px 64px rgba(0,0,0,0.4)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "24px 32px", borderBottom: "1px solid color-mix(in srgb, var(--color-text) 5%, transparent)" }}>
              <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Template do checklist de offboarding</h3>
            </div>
            
            <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24 }}>
              <span style={{ fontSize: 13, color: "color-mix(in srgb, var(--color-text) 70%, transparent)", lineHeight: 1.5 }}>
                Estes itens viram o checklist de RH e TI a cada novo desligamento. Desligamentos já em andamento não mudam.
              </span>
              <div style={{ display: "flex", gap: 32, flexWrap: "wrap", maxHeight: "50vh", overflowY: "auto" }}>
                {colunaTpl("rh", "Itens do RH")}
                {colunaTpl("ti", "Itens da TI")}
              </div>
            </div>
            <div style={{ padding: "16px 32px", borderTop: "1px solid color-mix(in srgb, var(--color-text) 5%, transparent)", display: "flex", justifyContent: "flex-end", gap: 12, background: "color-mix(in srgb, var(--color-text) 2%, transparent)" }}>
              <button style={{ ...btnSecondaryStyle, background: "transparent" }} onClick={() => setEditandoTpl(false)}>Cancelar</button>
              <button
                style={{ ...btnPrimaryStyle, opacity: pending ? 0.5 : 1 }}
                disabled={pending}
                onClick={() => start(async () => {
                  const res = await salvarTemplateChecklist(tpl);
                  toast(res.msg);
                  if (res.ok) { setEditandoTpl(false); router.refresh(); }
                })}
              >
                {pending ? "Salvando..." : "Salvar template"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
