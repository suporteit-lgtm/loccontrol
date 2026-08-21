"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui";
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
    <button
      onClick={onClick}
      role="switch"
      aria-checked={ativo}
      style={{
        width: 38,
        height: 22,
        flex: "none",
        borderRadius: 999,
        border: `1px solid ${ativo ? "var(--color-accent)" : "var(--color-neutral-400)"}`,
        background: ativo ? "var(--color-accent)" : "var(--color-neutral-300)",
        position: "relative",
        cursor: "pointer",
        padding: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: ativo ? 17 : 2,
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: "#fff",
          transition: "left 0.15s ease",
          display: "block",
        }}
      />
    </button>
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
    <div style={{ flex: 1, minWidth: 240, display: "flex", flexDirection: "column", gap: 6 }}>
      <h6 className="text-muted" style={{ margin: 0 }}>{rotulo}</h6>
      {tpl.map((item, i) =>
        item.lista !== lista ? null : (
          <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input
              className="input"
              style={{ fontSize: 13, minHeight: 32 }}
              value={item.titulo}
              onChange={(e) => setTpl((t) => t.map((x, j) => (j === i ? { ...x, titulo: e.target.value } : x)))}
            />
            <button
              title="Remover item"
              onClick={() => setTpl((t) => t.filter((_, j) => j !== i))}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--danger-forte)",
                fontSize: 13,
                padding: 2,
              }}
            >
              ✕
            </button>
          </div>
        )
      )}
      <button
        className="btn btn-ghost"
        style={{ fontSize: 12, alignSelf: "flex-start" }}
        onClick={() => setTpl((t) => [...t, { lista, titulo: "" }])}
      >
        + adicionar item
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
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "9px 0",
        borderBottom: "1px solid var(--color-divider)",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{label}</div>
        <div className="text-muted" style={{ fontSize: 12 }}>
          {desc}
        </div>
      </div>
      <Toggle ativo={!!notif[k]} onClick={() => alternar(k)} />
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", maxWidth: 820 }}>
      <PageHeader eyebrow="Transversal" titulo="Configurações" />

      <div className="card" style={{ gap: 12, maxWidth: 460 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span className="card-kicker">Conta</span>
          <span className="card-title">Minha senha</span>
          <span className="card-body" style={{ margin: 0 }}>
            Troque a sua senha de acesso. Só você pode alterá-la — para os demais, fale com o Admin T.I.
          </span>
        </div>
        <div className="field">
          <label>Senha atual</label>
          <CampoSenha value={senhaAtual} onChange={setSenhaAtual} autoComplete="current-password" />
        </div>
        <div className="field">
          <label>Nova senha · mínimo 8 caracteres</label>
          <CampoSenha value={senhaNova} onChange={setSenhaNova} />
        </div>
        <button
          className="btn btn-primary"
          style={{ alignSelf: "flex-start" }}
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
      <div className="card" style={{ gap: 12 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span className="card-kicker">Alertas</span>
            <span className="card-title">Notificações</span>
            <span className="card-body" style={{ margin: 0 }}>
              O sistema avisa as pessoas certas quando algo precisa de ação.
            </span>
          </div>
          <button
            className="btn btn-secondary"
            style={{ fontSize: 12 }}
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px 36px" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <h6 className="text-muted" style={{ margin: "0 0 4px" }}>Canais</h6>
            {CANAIS.map(([k, label, desc]) => linha(k, label, desc(email)))}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <h6 className="text-muted" style={{ margin: "0 0 4px" }}>Eventos</h6>
            {EVENTOS.map(([k, label, desc]) => linha(k, label, desc))}
          </div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "var(--space-3)" }}>
        <div className="card">
          <span className="card-kicker">Integração</span>
          <span className="card-title">QuarkRH</span>
          <span className="card-body">Fonte dos dados de pré-admissão. Busca por CPF ou matrícula.</span>
          <div className="card-meta">
            <span style={{ width: 8, height: 8, background: quarkOk ? "var(--ok)" : "var(--warn)", borderRadius: "50%" }} />
            {quarkOk ? "conectado" : "integração pendente"} ·{" "}
            <span style={{ fontFamily: "var(--mono)" }}>api.quarkrh.com.br</span>
          </div>
        </div>
        <div className="card">
          <span className="card-kicker">Integração</span>
          <span className="card-title">Google Workspace</span>
          <span className="card-body">Criação de contas, grupos e o bloqueio de emergência.</span>
          <div className="card-meta">
            <span style={{ width: 8, height: 8, background: workspaceOk ? "var(--ok)" : "var(--warn)", borderRadius: "50%" }} />
            {workspaceOk ? "conectado" : "integração pendente"} ·{" "}
            <span style={{ fontFamily: "var(--mono)" }}>locgrupo.com.br</span>
          </div>
        </div>
        <div className="card">
          <span className="card-kicker">Alertas</span>
          <span className="card-title">Destinatários</span>
          <span className="card-body">Recebem os alertas de 24h e 12h antes de cada admissão.</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            <span style={{ fontFamily: "var(--mono)", fontSize: 12, border: "1px solid var(--color-divider)", padding: "3px 8px" }}>
              rh@locgrupo.com.br
            </span>
            <span style={{ fontFamily: "var(--mono)", fontSize: 12, border: "1px solid var(--color-divider)", padding: "3px 8px" }}>
              suporte.ti@locgrupo.com.br
            </span>
          </div>
        </div>
        <div className="card">
          <span className="card-kicker">Templates</span>
          <span className="card-title">Checklist de offboarding</span>
          <span className="card-body">
            {nRh} itens de RH e {nTi} de TI. Aplicado a cada novo desligamento.
          </span>
          <button
            className="btn btn-secondary"
            style={{ alignSelf: "flex-start" }}
            onClick={() => {
              if (!admin) {
                toast("Somente administradores editam o template");
                return;
              }
              setTpl(template);
              setEditandoTpl(true);
            }}
          >
            Editar template
          </button>
        </div>
        {modelos.map((m) => {
          const [titulo, desc] = ROTULO_MODELO[m.chave] ?? [m.chave, "Modelo de e-mail automático."];
          return (
            <div className="card" key={m.chave}>
              <span className="card-kicker">E-mails automáticos</span>
              <span className="card-title">{titulo}</span>
              <span className="card-body">{desc}</span>
              {m.anexo_nome && (
                <span className="text-muted" style={{ fontSize: 12, fontFamily: "var(--mono)" }}>
                  📎 {m.anexo_nome}
                </span>
              )}
              <button
                className="btn btn-secondary"
                style={{ alignSelf: "flex-start" }}
                onClick={() => {
                  if (!admin) {
                    toast("Somente administradores editam o modelo");
                    return;
                  }
                  setBv({ assunto: m.assunto, corpo: m.corpo });
                  setEditandoBv(m);
                }}
              >
                Editar template
              </button>
            </div>
          );
        })}
        <div className="card">
          <span className="card-kicker">Templates</span>
          <span className="card-title">Equipamentos</span>
          <span className="card-body">
            {equipamentos.length} equipamento(s) no catálogo · {equipamentos.filter((e) => e.kit).length} no kit
            padrão pré-selecionado nas admissões.
          </span>
          <button
            className="btn btn-secondary"
            style={{ alignSelf: "flex-start" }}
            onClick={() => {
              if (!admin) {
                toast("Somente administradores editam o catálogo");
                return;
              }
              setEqs(equipamentos);
              setEditandoEq(true);
            }}
          >
            Editar template
          </button>
        </div>
      </div>

      {editandoBv && (
        <div className="dialog-backdrop">
          <div className="dialog" style={{ width: "min(620px, 100%)" }}>
            <span className="dialog-title">
              {(ROTULO_MODELO[editandoBv.chave] ?? [editandoBv.chave])[0]}
            </span>
            <div className="dialog-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <span>
                {(ROTULO_MODELO[editandoBv.chave] ?? ["", ""])[1]} Pode usar:{" "}
                <span style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
                  {"{nome} {primeiro_nome} {email} {cargo} {unidade}"}
                  {editandoBv.chave === "credenciais" ? " {senha}" : ""}
                </span>
              </span>
              <div className="field">
                <label>Assunto</label>
                <input className="input" value={bv.assunto} onChange={(e) => setBv((b) => ({ ...b, assunto: e.target.value }))} />
              </div>
              <div className="field">
                <label>Corpo</label>
                <textarea
                  className="input"
                  rows={12}
                  style={{ resize: "vertical", fontSize: 13, lineHeight: 1.5 }}
                  value={bv.corpo}
                  onChange={(e) => setBv((b) => ({ ...b, corpo: e.target.value }))}
                />
              </div>
            </div>
            <div className="dialog-actions">
              <button className="btn btn-secondary" onClick={() => setEditandoBv(null)}>
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await salvarModeloEmail(editandoBv.chave, bv.assunto, bv.corpo);
                    toast(res.msg);
                    if (res.ok) {
                      setEditandoBv(null);
                      router.refresh();
                    }
                  })
                }
              >
                {pending ? "Salvando..." : "Salvar modelo"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editandoEq && (
        <div className="dialog-backdrop">
          <div className="dialog" style={{ width: "min(520px, 100%)" }}>
            <span className="dialog-title">Catálogo de equipamentos</span>
            <div className="dialog-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <span>
                A lista aparece no passo 2 da pré-admissão. Marque <strong>Kit</strong> no que deve vir
                pré-selecionado.
              </span>
              <div style={{ maxHeight: "46vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                {eqs.map((item, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      className="input"
                      style={{ fontSize: 13, minHeight: 32 }}
                      value={item.nome}
                      onChange={(e) => setEqs((t) => t.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)))}
                    />
                    <label
                      style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}
                    >
                      <input
                        type="checkbox"
                        checked={item.kit}
                        onChange={() => setEqs((t) => t.map((x, j) => (j === i ? { ...x, kit: !x.kit } : x)))}
                        style={{ accentColor: "var(--color-accent)", width: 15, height: 15 }}
                      />
                      Kit
                    </label>
                    <button
                      title="Remover"
                      onClick={() => setEqs((t) => t.filter((_, j) => j !== i))}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger-forte)", fontSize: 13, padding: 2 }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: 12, alignSelf: "flex-start" }}
                  onClick={() => setEqs((t) => [...t, { nome: "", kit: false }])}
                >
                  + adicionar equipamento
                </button>
              </div>
            </div>
            <div className="dialog-actions">
              <button className="btn btn-secondary" onClick={() => setEditandoEq(false)}>
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await salvarEquipamentos(eqs);
                    toast(res.msg);
                    if (res.ok) {
                      setEditandoEq(false);
                      router.refresh();
                    }
                  })
                }
              >
                {pending ? "Salvando..." : "Salvar catálogo"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editandoTpl && (
        <div className="dialog-backdrop">
          <div className="dialog" style={{ width: "min(680px, 100%)" }}>
            <span className="dialog-title">Template do checklist de offboarding</span>
            <div className="dialog-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <span>
                Estes itens viram o checklist de RH e TI a cada novo desligamento. Desligamentos já em andamento não
                mudam.
              </span>
              <div style={{ display: "flex", gap: 24, flexWrap: "wrap", maxHeight: "50vh", overflowY: "auto" }}>
                {colunaTpl("rh", "Itens do RH")}
                {colunaTpl("ti", "Itens da TI")}
              </div>
            </div>
            <div className="dialog-actions">
              <button className="btn btn-secondary" onClick={() => setEditandoTpl(false)}>
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await salvarTemplateChecklist(tpl);
                    toast(res.msg);
                    if (res.ok) {
                      setEditandoTpl(false);
                      router.refresh();
                    }
                  })
                }
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
