"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { concluirBloqueio, executarPasso, removerBloqueio } from "@/app/actions/restrita";
import type { PassoPanico } from "@/services/googleWorkspace";

interface Alvo {
  id: string;
  nome: string;
  bloqueado: { quando: string; por: string; motivo: string } | null;
}

type StPasso = "espera" | "run" | "ok" | "erro";

const PASSOS: { key: PassoPanico; l: string }[] = [
  { key: "senha", l: "Substituir a senha por uma sequência aleatória" },
  { key: "recuperacao", l: "Remover e-mail e telefone de recuperação" },
  { key: "sessoes", l: "Encerrar todas as sessões em todos os dispositivos" },
];

export function RestritaClient({
  ativos,
  alvoInicial,
  grupoTI,
}: {
  ativos: Alvo[];
  alvoInicial: string;
  grupoTI: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [alvoId, setAlvoId] = useState(alvoInicial);
  const [fase, setFase] = useState<"card" | "modal" | "exec" | "done">("card");
  const [motivo, setMotivo] = useState("");
  const [nome, setNome] = useState("");
  const [hold, setHold] = useState(0);
  const [passos, setPassos] = useState<StPasso[]>(["espera", "espera", "espera"]);
  const [quandoDone, setQuandoDone] = useState("");
  const [motivoDone, setMotivoDone] = useState("");
  const [, start2] = useTransition();
  const holdInt = useRef<ReturnType<typeof setInterval> | null>(null);

  const alvo = ativos.find((a) => a.id === alvoId) ?? ativos[0];

  useEffect(
    () => () => {
      if (holdInt.current) clearInterval(holdInt.current);
    },
    []
  );

  if (!alvo) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", maxWidth: 620 }}>
        <PageHeader eyebrow="Área restrita · RH e TI" titulo="Ações de segurança" />
        <div className="card" style={{ alignItems: "center", padding: "var(--space-6)" }}>
          <span className="text-muted" style={{ fontSize: 13 }}>
            Nenhum colaborador ativo para bloquear
          </span>
        </div>
      </div>
    );
  }

  const primeiroNome = alvo.nome.split(" ")[0];
  const motivoOk = motivo.trim().length >= 10;
  const nomeOk = nome.trim().toUpperCase() === alvo.nome.toUpperCase();
  const bloqueado = alvo.bloqueado;

  const rodarPasso = async (i: number, atuais: StPasso[]): Promise<void> => {
    const novos = [...atuais];
    novos[i] = "run";
    setPassos([...novos]);
    const r = await executarPasso(alvo.id, PASSOS[i].key);
    novos[i] = r.ok ? "ok" : "erro";
    setPassos([...novos]);
    if (r.ok) {
      if (i + 1 < PASSOS.length) {
        await rodarPasso(i + 1, novos);
      } else {
        await finalizar();
      }
    }
  };

  const finalizar = async () => {
    const res = await concluirBloqueio(alvo.id, motivo);
    if (res.ok) {
      setQuandoDone(res.quando);
      setMotivoDone(motivo);
      setFase("done");
      router.refresh();
    }
  };

  const retry = async (i: number) => {
    const atuais = [...passos];
    await rodarPasso(i, atuais);
  };

  const execPanico = () => {
    setFase("exec");
    setPassos(["espera", "espera", "espera"]);
    void rodarPasso(0, ["espera", "espera", "espera"]);
  };

  const holdIni = () => {
    if (holdInt.current) clearInterval(holdInt.current);
    holdInt.current = setInterval(() => {
      setHold((v) => {
        const novo = v + 5;
        if (novo >= 100) {
          if (holdInt.current) clearInterval(holdInt.current);
          holdInt.current = null;
          execPanico();
          return 0;
        }
        return novo;
      });
    }, 100);
  };

  const holdFim = () => {
    if (holdInt.current) {
      clearInterval(holdInt.current);
      holdInt.current = null;
    }
    if (fase === "modal") setHold(0);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", maxWidth: 620 }}>
      <PageHeader eyebrow="Área restrita · RH e TI" titulo="Ações de segurança" />
      <div className="field" style={{ maxWidth: 320 }}>
        <label>Colaborador</label>
        <select
          className="input"
          value={alvo.id}
          onChange={(e) => {
            setAlvoId(e.target.value);
            setFase("card");
            setMotivo("");
            setNome("");
            setHold(0);
          }}
        >
          {ativos.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nome}
            </option>
          ))}
        </select>
      </div>

      {fase === "card" && !bloqueado && (
        <div
          className="blueprint"
          style={{
            background: "var(--danger-bg)",
            border: "1px solid var(--danger)",
            padding: "var(--space-4)",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <h4 style={{ margin: 0, color: "var(--danger-forte)" }}>Bloqueio de emergência</h4>
          <div style={{ fontSize: 14, lineHeight: 1.6 }}>
            Ao confirmar, estas três ações são executadas, nesta ordem:
            <ol style={{ margin: "8px 0", paddingLeft: 20, display: "flex", flexDirection: "column", gap: 4 }}>
              <li>Senha substituída por uma sequência aleatória</li>
              <li>E-mail e telefone de recuperação removidos</li>
              <li>Todas as sessões encerradas em todos os dispositivos</li>
            </ol>
            <strong>A conta e os dados não são apagados.</strong> A ação não é reversível por esta interface — o
            desbloqueio é feito no console do Workspace por um administrador.
          </div>
          <button
            className="btn btn-danger"
            onClick={() => {
              setFase("modal");
              setHold(0);
            }}
            style={{ alignSelf: "flex-start" }}
          >
            Bloquear acesso de {primeiroNome}
          </button>
        </div>
      )}

      {fase === "exec" && (
        <div className="card" style={{ gap: "var(--space-2)", borderColor: "var(--danger)" }}>
          <span className="card-title" style={{ color: "var(--danger-forte)" }}>
            Executando bloqueio · {alvo.nome}
          </span>
          {PASSOS.map((p, i) => {
            const st = passos[i];
            return (
              <div
                key={p.key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 0",
                  borderBottom: "1px solid var(--color-divider)",
                  fontSize: 14,
                }}
              >
                {st === "run" && (
                  <span
                    style={{
                      width: 16,
                      height: 16,
                      flex: "none",
                      border: "2px solid var(--color-neutral-300)",
                      borderTopColor: "var(--danger)",
                      borderRadius: "50%",
                      animation: "giro .8s linear infinite",
                    }}
                  />
                )}
                {st === "ok" && <span style={{ width: 16, flex: "none", color: "var(--ok)", fontWeight: 700 }}>✓</span>}
                {st === "erro" && (
                  <span style={{ width: 16, flex: "none", color: "var(--danger)", fontWeight: 700 }}>✕</span>
                )}
                {st === "espera" && (
                  <span style={{ width: 16, flex: "none" }} className="text-muted">
                    ·
                  </span>
                )}
                <span style={{ flex: 1 }}>{p.l}</span>
                {st === "erro" && (
                  <button
                    className="btn btn-secondary"
                    onClick={() => void retry(i)}
                    style={{ fontSize: 12, padding: "3px 10px" }}
                  >
                    Tentar novamente
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {(fase === "done" || (fase === "card" && bloqueado)) && (
        <div
          style={{
            border: "1px solid var(--danger)",
            background: "var(--danger-bg)",
            padding: "14px 16px",
            fontSize: 14,
            color: "var(--danger-forte)",
            borderRadius: 10,
          }}
        >
          <strong>Acesso bloqueado</strong> em {quandoDone || bloqueado?.quando} por{" "}
          {fase === "done" ? "Você" : bloqueado?.por}. Motivo: {motivoDone || bloqueado?.motivo}. Esta faixa fica
          registrada no perfil.
          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-secondary" onClick={() => router.push(`/colaboradores/${alvo.id}`)}>
              Ver perfil
            </button>
            {grupoTI && (
              <button
                className="btn btn-secondary"
                title="Remove o bloqueio do perfil no sistema (caso a pessoa volte à empresa). A conta Google continua como está — reative-a no console do Workspace."
                onClick={() =>
                  start2(async () => {
                    const res = await removerBloqueio(alvo.id);
                    toast(res.msg);
                    if (res.ok) {
                      setFase("card");
                      setQuandoDone("");
                      setMotivoDone("");
                      router.refresh();
                    }
                  })
                }
              >
                Remover bloqueio do perfil
              </button>
            )}
          </div>
        </div>
      )}

      {fase === "modal" && (
        <div className="dialog-backdrop">
          <div className="dialog" style={{ border: "1px solid var(--danger)" }}>
            <span className="dialog-title" style={{ color: "var(--danger-forte)" }}>
              Bloquear acesso de {alvo.nome}
            </span>
            <div className="dialog-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="field">
                <label>Motivo · mínimo 10 caracteres</label>
                <input
                  className="input"
                  placeholder="ex.: notebook furtado com sessão aberta"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                />
              </div>
              <div className="field">
                <label>Digite {alvo.nome.toUpperCase()} para confirmar</label>
                <input
                  className="input"
                  style={{ fontFamily: "var(--mono)" }}
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                />
              </div>
              <span className="text-muted" style={{ fontSize: 12 }}>
                Com os dois campos corretos, pressione e segure o botão por 2 segundos.
              </span>
            </div>
            <div className="dialog-actions" style={{ alignItems: "center" }}>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setFase("card");
                  setHold(0);
                }}
              >
                Cancelar
              </button>
              <button
                className="btn btn-danger"
                onMouseDown={holdIni}
                onMouseUp={holdFim}
                onMouseLeave={holdFim}
                onTouchStart={holdIni}
                onTouchEnd={holdFim}
                disabled={!(motivoOk && nomeOk)}
                style={{ gap: 10, userSelect: "none" }}
              >
                <span
                  style={{
                    width: 16,
                    height: 16,
                    flex: "none",
                    borderRadius: "50%",
                    background: `conic-gradient(#fff ${Math.round(hold * 3.6)}deg, rgba(255,255,255,.25) 0deg)`,
                  }}
                />
                Segurar para bloquear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
