"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useNow } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { InputMascarado } from "@/components/Mascaras";
import { sla, primeiroNome } from "@/lib/format";
import { ativarColaborador, silenciarChamado, verificarEmail, concluirChamado } from "@/app/actions/chamados";

interface Props {
  chamado: { id: string; tipo: string; slaAlvo: string | null; solicitante: string | null };
  colab: {
    id: string;
    nome: string;
    cargo: string;
    unidade: string;
    admissao: string;
    grupos: string[];
    equipamentos: string[];
    obs: string | null;
    emailAtual: string | null;
  };
  acessos: { nome: string; obrig: boolean }[];
  emailSugerido: string;
}

export function ChamadoClient({ chamado, colab, acessos, emailSugerido }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const now = useNow();
  const [marcados, setMarcados] = useState<Record<string, boolean>>({});
  const [email, setEmail] = useState(emailSugerido);
  const [modal, setModal] = useState(false);
  const [checagem, setChecagem] = useState<{ existeWorkspace: boolean; duplicado: string | null } | null>(null);
  const [grupos, setGrupos] = useState<string[]>(colab.grupos);
  const [novoGrupo, setNovoGrupo] = useState("");
  // conta criada fora do Workspace: só registrar o endereço, sem criar nada
  const [jaCriado, setJaCriado] = useState(false);
  const [modalConcluir, setModalConcluir] = useState(false);
  // já confirmou uma vez (ou a conta veio pronta do servidor): botão vira cinza
  const [criadoAgora, setCriadoAgora] = useState(false);
  const contaCriada = criadoAgora || !!colab.emailAtual;
  const [pending, start] = useTransition();

  const sl = sla(chamado.slaAlvo, now);
  const nMarcados = acessos.filter((a) => marcados[a.nome]).length;
  const emailOk = email.includes("@");

  const ativar = () =>
    start(async () => {
      const res = await ativarColaborador(chamado.id, email, grupos, jaCriado);
      toast(res.msg);
      setModal(false);
      if (res.ok) {
        setCriadoAgora(true);
        router.refresh(); // o chamado segue aberto — a TI continua nele
      }
    });

  const concluir = () =>
    start(async () => {
      const res = await concluirChamado(chamado.id);
      toast(res.msg);
      setModalConcluir(false);
      if (res.ok) router.push("/fila-ti");
    });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", maxWidth: 900 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h6 className="text-muted" style={{ margin: 0 }}>
            Visão TI · <span style={{ fontFamily: "var(--mono)" }}>{chamado.id}</span>
          </h6>
          <h2 style={{ margin: 0 }}>
            {chamado.tipo} · {colab.nome}
          </h2>
          <div className="text-muted" style={{ fontSize: 13 }}>
            {colab.cargo} · {colab.unidade} · admissão {colab.admissao}
            {chamado.solicitante ? ` · aberto por ${chamado.solicitante}` : ""} ·{" "}
            <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: sl?.cor ?? "var(--color-neutral-500)" }}>
              {sl ? `faltam ${sl.txt}` : "sem prazo"}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => router.push("/fila-ti")}>
            Voltar à fila
          </button>
          <button
            className="btn btn-ghost"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await silenciarChamado(chamado.id);
                toast(res.msg);
                router.push("/fila-ti");
              })
            }
          >
            Pré-concluído
          </button>
          <button
            className="btn btn-primary"
            disabled={pending || !contaCriada}
            title={contaCriada ? "Encerrar o chamado — tudo entregue" : "Crie ou registre o e-mail antes de concluir"}
            onClick={() => setModalConcluir(true)}
          >
            Concluir chamado
          </button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "var(--space-4)" }}>
        <div className="card" style={{ gap: "var(--space-2)" }}>
          <span className="card-title">Acessos a conceder</span>
          {acessos.map((a) => (
            <label
              key={a.nome}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: 14,
                padding: "6px 0",
                borderBottom: "1px solid var(--color-divider)",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={!!marcados[a.nome]}
                onChange={() => setMarcados((m) => ({ ...m, [a.nome]: !m[a.nome] }))}
                style={{ accentColor: "var(--color-accent)", width: 15, height: 15 }}
              />
              <span style={{ flex: 1 }}>{a.nome}</span>
              {a.obrig && <span style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>🔒</span>}
            </label>
          ))}
          {acessos.length === 0 && (
            <span className="text-muted" style={{ fontSize: 13 }}>
              O RH não solicitou nenhum acesso além da conta de e-mail para este colaborador.
            </span>
          )}
          <span className="text-muted" style={{ fontSize: 12, fontFamily: "var(--mono)" }}>
            {nMarcados} de {acessos.length} concedidos
          </span>
          <div style={{ marginTop: 6 }}>
            <h6 className="text-muted" style={{ margin: "0 0 6px" }}>
              Equipamentos a separar
            </h6>
            {colab.equipamentos.length ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {colab.equipamentos.map((e) => (
                  <span
                    key={e}
                    style={{
                      fontSize: 12,
                      border: "1px solid var(--color-divider)",
                      borderRadius: 999,
                      padding: "2px 10px",
                    }}
                  >
                    {e}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-muted" style={{ fontSize: 12 }}>
                O RH não marcou nenhum equipamento.
              </span>
            )}
          </div>
        </div>
        <div className="card" style={{ gap: "var(--space-3)" }}>
          <span className="card-title">Conta e acessos</span>
          <div className="field">
            <label>E-mail corporativo · preencher cria a conta no Workspace</label>
            <InputMascarado
              tipo="email"
              placeholder="nome.sobrenome@locgrupo.com.br"
              value={email}
              onChange={setEmail}
              onBlur={() => {
                setChecagem(null);
                if (!emailOk) return;
                // descobre antes de confirmar se a conta já existe no Workspace
                start(async () => setChecagem(await verificarEmail(email, colab.id)));
              }}
            />
          </div>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              fontSize: 13,
              cursor: "pointer",
              padding: "2px 0",
            }}
          >
            <input
              type="checkbox"
              checked={jaCriado}
              onChange={() => setJaCriado((v) => !v)}
              style={{ accentColor: "var(--color-accent)", width: 15, height: 15, flex: "none" }}
            />
            <span>
              O e-mail <strong>já foi criado em outro lugar</strong> — apenas registrar o endereço
            </span>
          </label>
          {jaCriado && (
            <div
              style={{
                fontSize: 12.5,
                border: "1px solid var(--warn)",
                background: "var(--warn-bg)",
                color: "var(--warn-forte)",
                borderRadius: 8,
                padding: "8px 10px",
              }}
            >
              Nada será criado no Workspace e os grupos acima <strong>não serão aplicados automaticamente</strong>{" "}
              — aplique-os onde a conta foi criada. As credenciais vão para o e-mail pessoal com o{" "}
              <strong>link do webmail</strong> (a senha deve ser a padrão da empresa).
            </div>
          )}
          {!jaCriado && checagem?.existeWorkspace && (
            <div
              style={{
                fontSize: 12.5,
                border: "1px solid var(--ok)",
                background: "var(--ok-bg, transparent)",
                color: "var(--ok-forte)",
                borderRadius: 8,
                padding: "8px 10px",
              }}
            >
              ✓ Esta conta <strong>já existe no Workspace</strong>. Nada será criado — o LOCCONTROL só vincula o
              endereço, aplica os grupos e mantém a senha atual.
              {checagem.duplicado && (
                <>
                  <br />
                  Também existe a ficha <strong>{checagem.duplicado}</strong>; ela será fundida nesta.
                </>
              )}
            </div>
          )}
          <div>
            <h6 className="text-muted" style={{ margin: "0 0 6px" }}>
              Grupos que serão aplicados
            </h6>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {grupos.map((g) => (
                <span
                  key={g}
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 12,
                    border: "1px solid var(--color-divider)",
                    padding: "4px 8px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    alignSelf: "flex-start",
                  }}
                >
                  {g}
                  <button
                    title={`Remover ${g}`}
                    onClick={() => setGrupos((l) => l.filter((x) => x !== g))}
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
                </span>
              ))}
              {grupos.length === 0 && (
                <span className="text-muted" style={{ fontSize: 12 }}>
                  Nenhum grupo será aplicado.
                </span>
              )}
              <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                <input
                  className="input"
                  style={{ maxWidth: 240, fontSize: 12, minHeight: 30, fontFamily: "var(--mono)" }}
                  placeholder="grupo@locgrupo.com.br"
                  value={novoGrupo}
                  onChange={(e) => setNovoGrupo(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    const v = novoGrupo.trim().toLowerCase();
                    if (v.includes("@") && !grupos.includes(v)) setGrupos((l) => [...l, v]);
                    setNovoGrupo("");
                  }}
                />
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: 12, padding: "3px 10px" }}
                  onClick={() => {
                    const v = novoGrupo.trim().toLowerCase();
                    if (!v.includes("@")) {
                      toast("Informe um e-mail de grupo válido");
                      return;
                    }
                    if (!grupos.includes(v)) setGrupos((l) => [...l, v]);
                    setNovoGrupo("");
                  }}
                >
                  + grupo
                </button>
              </div>
            </div>
          </div>
          {colab.obs && (
            <div style={{ fontSize: 13, borderLeft: "2px solid var(--color-accent-300)", paddingLeft: 10 }}>
              <span className="text-muted">Observação do RH:</span> {colab.obs}
            </div>
          )}
          <button
            className="btn btn-primary"
            onClick={() => setModal(true)}
            disabled={!emailOk || pending || contaCriada}
            style={{ marginTop: "auto" }}
          >
            {contaCriada ? "✓ Conta criada" : jaCriado ? "Registrar e-mail" : "Criar conta e avisar o RH"}
          </button>
          <span className="text-muted" style={{ fontSize: 11.5, textAlign: "center" }}>
            {contaCriada
              ? "Conta pronta — encerre no botão do topo quando tudo estiver entregue."
              : "Isso não encerra o chamado — conclua no botão do topo quando tudo estiver entregue."}
          </span>
        </div>
      </div>

      {modalConcluir && (
        <div className="dialog-backdrop">
          <div className="dialog">
            <span className="dialog-title">Concluir o chamado {chamado.id}?</span>
            <div className="dialog-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span>
                Confirme que a parte da TI está <strong>toda entregue</strong> — conta, acessos e equipamentos. O
                chamado sai da fila e vai para o histórico.
              </span>
              {colab.emailAtual && (
                <span className="text-muted" style={{ fontSize: 12.5, fontFamily: "var(--mono)" }}>
                  e-mail registrado: {colab.emailAtual}
                </span>
              )}
            </div>
            <div className="dialog-actions">
              <button className="btn btn-secondary" onClick={() => setModalConcluir(false)}>
                Ainda não
              </button>
              <button className="btn btn-primary" onClick={concluir} disabled={pending}>
                {pending ? "Concluindo..." : "Concluir chamado"}
              </button>
            </div>
          </div>
        </div>
      )}

      {modal && (
        <div className="dialog-backdrop">
          <div className="dialog">
            <span className="dialog-title">
              {jaCriado ? "Registrar e-mail já criado?" : checagem?.existeWorkspace ? "Vincular conta existente?" : "Criar a conta?"}
            </span>
            <div className="dialog-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <span>
                A conta <span style={{ fontFamily: "var(--mono)", fontSize: 13 }}>{email}</span>{" "}
                {jaCriado
                  ? "foi criada fora do Workspace e será apenas registrada — nenhum grupo será aplicado por aqui"
                  : checagem?.existeWorkspace
                    ? "já existe e será apenas vinculada; estes grupos serão aplicados"
                    : "será criada; estes grupos serão aplicados"}
                . O RH será avisado para ativar o colaborador na empresa — o chamado segue aberto até você
                concluir:
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {grupos.map((g) => (
                  <span
                    key={g}
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: 12,
                      border: "1px solid var(--color-divider)",
                      padding: "4px 8px",
                      alignSelf: "flex-start",
                    }}
                  >
                    {g}
                  </span>
                ))}
              </div>
            </div>
            <div className="dialog-actions">
              <button className="btn btn-secondary" onClick={() => setModal(false)}>
                Ainda não
              </button>
              <button className="btn btn-primary" onClick={ativar} disabled={pending}>
                {pending
                  ? "Salvando..."
                  : jaCriado
                    ? "Registrar e-mail"
                    : checagem?.existeWorkspace
                      ? "Vincular e aplicar grupos"
                      : "Criar conta e aplicar grupos"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
