"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { excluirSala, salvarConfigSalas, salvarSala, type SalaForm } from "@/app/actions/salas";
import { duracao, hhmm, type ConfigSalas, type Sala } from "@/lib/salas/regras";

const VAZIA: SalaForm = { nome: "", descricao: "", capacidade: 4, local: "", recursos: "", ativo: true, ordem: 0 };

export function CadastroSalasClient({ salas, config }: { salas: Sala[]; config: ConfigSalas }) {
  const { toast } = useToast();
  const router = useRouter();
  const [editando, setEditando] = useState<SalaForm | null>(null);
  const [excluindo, setExcluindo] = useState<Sala | null>(null);
  const [pend, start] = useTransition();

  const remover = (s: Sala) =>
    start(async () => {
      const r = await excluirSala(s.id);
      setExcluindo(null);
      if (!r.ok) return toast(r.erro, "erro");
      toast(r.desativada ? `${s.nome} tem histórico de uso: foi desativada e saiu da agenda.` : `${s.nome} excluída.`, "ok");
      router.refresh();
    });

  return (
    <div className="esc-grade-21" style={{ gap: "var(--space-4)", alignItems: "start" }}>
      <div className="card elev-sm" style={{ gap: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <div className="card-title">Salas ({salas.length})</div>
          <button className="btn btn-primary" onClick={() => setEditando({ ...VAZIA, ordem: salas.length + 1 })}>
            + Nova sala
          </button>
        </div>
        {salas.length === 0 ? (
          <p className="text-muted" style={{ fontSize: 14 }}>
            Nenhuma sala cadastrada ainda. Clique em <strong>Nova sala</strong> para começar.
          </p>
        ) : (
          <div className="esc-lista">
            {salas.map((s) => (
              <div key={s.id} className="esc-linha" style={{ opacity: s.ativo ? 1 : 0.55 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                  <strong>
                    {s.nome}
                    {!s.ativo && (
                      <span className="tag tag-neutral" style={{ marginLeft: 8, fontSize: 11 }}>
                        desativada
                      </span>
                    )}
                  </strong>
                  <span className="text-muted" style={{ fontSize: 13 }}>
                    {[s.descricao, `${s.capacidade} ${s.capacidade === 1 ? "pessoa" : "pessoas"}`, s.local, s.recursos.join(", ")]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </div>
                <span style={{ display: "flex", gap: 6, flex: "none" }}>
                  <button
                    className="btn btn-secondary"
                    style={{ height: 32, fontSize: 13 }}
                    onClick={() =>
                      setEditando({
                        id: s.id,
                        nome: s.nome,
                        descricao: s.descricao ?? "",
                        capacidade: s.capacidade,
                        local: s.local ?? "",
                        recursos: s.recursos.join(", "),
                        ativo: s.ativo,
                        ordem: s.ordem,
                      })
                    }
                  >
                    Editar
                  </button>
                  <button className="btn btn-secondary" style={{ height: 32, fontSize: 13, color: "var(--danger)" }} onClick={() => setExcluindo(s)}>
                    Excluir
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <Regras config={config} />

      {editando && <EditarSala inicial={editando} fechar={() => setEditando(null)} />}
      {excluindo && (
        <div className="dialog-backdrop folha" onClick={(e) => e.target === e.currentTarget && setExcluindo(null)}>
          <div className="dialog">
            <span className="dialog-title">Excluir {excluindo.nome}?</span>
            <div className="dialog-body">
              A sala sai da agenda. Se ela já foi usada, o histórico é mantido e ela só fica desativada. Agendamentos futuros
              precisam ser cancelados antes.
            </div>
            <div className="dialog-actions">
              <button className="btn btn-secondary" onClick={() => setExcluindo(null)}>
                Voltar
              </button>
              <button className="btn btn-danger" disabled={pend} onClick={() => remover(excluindo)}>
                {pend ? "Excluindo…" : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EditarSala({ inicial, fechar }: { inicial: SalaForm; fechar: () => void }) {
  const { toast } = useToast();
  const router = useRouter();
  const [f, setF] = useState(inicial);
  const [erro, setErro] = useState<string | null>(null);
  const [pend, start] = useTransition();
  const campo = <K extends keyof SalaForm>(k: K, v: SalaForm[K]) => setF((x) => ({ ...x, [k]: v }));

  const salvar = (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    start(async () => {
      const r = await salvarSala(f);
      if (!r.ok) return setErro(r.erro);
      toast(`${f.nome.trim()} salva.`, "ok");
      fechar();
      router.refresh();
    });
  };

  return (
    <div className="dialog-backdrop folha" onClick={(e) => e.target === e.currentTarget && fechar()}>
      <form className="dialog" onSubmit={salvar} style={{ width: "min(520px, 100%)" }}>
        <span className="dialog-title">{f.id ? `Editar ${inicial.nome}` : "Nova sala"}</span>
        <div className="field">
          <label htmlFor="s-nome">Nome</label>
          <input
            id="s-nome"
            className="input"
            value={f.nome}
            maxLength={60}
            required
            onChange={(e) => campo("nome", e.target.value)}
            placeholder="Ex.: Sala 11"
            autoFocus
          />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 12 }}>
          <div className="field">
            <label htmlFor="s-desc">Tipo / descrição</label>
            <input
              id="s-desc"
              className="input"
              value={f.descricao}
              maxLength={80}
              onChange={(e) => campo("descricao", e.target.value)}
              placeholder="Ex.: Foco para call"
            />
          </div>
          <div className="field">
            <label htmlFor="s-cap">Capacidade</label>
            <input
              id="s-cap"
              className="input"
              type="number"
              min={1}
              max={200}
              value={f.capacidade}
              onChange={(e) => campo("capacidade", Number(e.target.value))}
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="s-local">Local (opcional)</label>
          <input
            id="s-local"
            className="input"
            value={f.local}
            maxLength={80}
            onChange={(e) => campo("local", e.target.value)}
            placeholder="Ex.: BH · Centro · 2º andar"
          />
        </div>
        <div className="field">
          <label htmlFor="s-rec">Recursos (opcional, separados por vírgula)</label>
          <input
            id="s-rec"
            className="input"
            value={f.recursos}
            onChange={(e) => campo("recursos", e.target.value)}
            placeholder="Ex.: TV, Videoconferência, Quadro branco"
          />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 12, alignItems: "end" }}>
          <div className="field">
            <label htmlFor="s-ordem">Ordem na agenda</label>
            <input id="s-ordem" className="input" type="number" value={f.ordem} onChange={(e) => campo("ordem", Number(e.target.value))} />
          </div>
          <button type="button" className="esc-switch" role="switch" aria-checked={f.ativo} onClick={() => campo("ativo", !f.ativo)}>
            <span className="esc-switch-trilho">
              <span />
            </span>
            <span style={{ fontSize: 14 }}>{f.ativo ? "Disponível para agendar" : "Desativada (fora da agenda)"}</span>
          </button>
        </div>
        {erro && (
          <div role="alert" style={{ fontSize: 13, color: "var(--danger-forte)", background: "var(--danger-bg)", borderRadius: 8, padding: "8px 12px" }}>
            {erro}
          </div>
        )}
        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={fechar}>
            Voltar
          </button>
          <button className="btn btn-primary" disabled={pend}>
            {pend ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </form>
    </div>
  );
}

const HORAS = Array.from({ length: 47 }, (_, i) => hhmm((i + 1) * 30)); // 00:30 … 23:30

function Regras({ config }: { config: ConfigSalas }) {
  const { toast } = useToast();
  const router = useRouter();
  const [c, setC] = useState(config);
  const [pend, start] = useTransition();
  const mudou = JSON.stringify(c) !== JSON.stringify(config);
  const campo = <K extends keyof ConfigSalas>(k: K, v: ConfigSalas[K]) => setC((x) => ({ ...x, [k]: v }));

  const salvar = () =>
    start(async () => {
      const r = await salvarConfigSalas(c);
      if (!r.ok) return toast(r.erro, "erro");
      toast("Regras das salas salvas.", "ok");
      router.refresh();
    });

  return (
    <div className="card elev-sm">
      <div className="card-title">Regras de agendamento</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="field">
          <label htmlFor="r-ini">Abre às</label>
          <select id="r-ini" className="input" value={c.hora_inicio} onChange={(e) => campo("hora_inicio", e.target.value)}>
            {HORAS.map((h) => (
              <option key={h}>{h}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="r-fim">Fecha às</label>
          <select id="r-fim" className="input" value={c.hora_fim} onChange={(e) => campo("hora_fim", e.target.value)}>
            {HORAS.map((h) => (
              <option key={h}>{h}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="r-int">Blocos de horário</label>
        <select id="r-int" className="input" value={c.intervalo_min} onChange={(e) => campo("intervalo_min", Number(e.target.value))}>
          <option value={15}>15 minutos</option>
          <option value={30}>30 minutos</option>
          <option value={60}>1 hora</option>
        </select>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="field">
          <label htmlFor="r-ant">Agendar com até (dias)</label>
          <input
            id="r-ant"
            className="input"
            type="number"
            min={1}
            max={365}
            value={c.dias_antecedencia}
            onChange={(e) => campo("dias_antecedencia", Number(e.target.value))}
          />
        </div>
        <div className="field">
          <label htmlFor="r-dur">Duração máxima</label>
          <select id="r-dur" className="input" value={c.duracao_max_min} onChange={(e) => campo("duracao_max_min", Number(e.target.value))}>
            {[60, 90, 120, 180, 240, 360, 480, 720].map((m) => (
              <option key={m} value={m}>
                {duracao(m)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <button type="button" className="esc-switch" role="switch" aria-checked={c.fim_de_semana} onClick={() => campo("fim_de_semana", !c.fim_de_semana)}>
        <span className="esc-switch-trilho">
          <span />
        </span>
        <span style={{ fontSize: 14 }}>Permitir agendar no fim de semana</span>
      </button>
      <p className="text-muted" style={{ fontSize: 12.5, margin: 0 }}>
        Administradores podem agendar além da antecedência e da duração máxima. Agendamentos já feitos não mudam.
      </p>
      <button className="btn btn-primary" disabled={!mudou || pend} onClick={salvar} style={{ alignSelf: "flex-start" }}>
        {pend ? "Salvando…" : "Salvar regras"}
      </button>
    </div>
  );
}
