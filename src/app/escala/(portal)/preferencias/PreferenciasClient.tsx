"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { StatusTag } from "@/components/escala/AcoesDia";
import { gerarFeedIcs, revogarFeedIcs, salvarLembretes, type Resultado } from "@/app/escala/actions";
import { horaSP } from "@/lib/escala/formato";

export function PreferenciasClient({
  email,
  lembretes,
  icsCriadoEm,
  agendaAtiva,
}: {
  email: string;
  lembretes: boolean;
  icsCriadoEm: string | null;
  agendaAtiva: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [link, setLink] = useState<string | null>(null);

  const exec = (fn: () => Promise<Resultado>, depois?: (r: Resultado) => void) =>
    start(async () => {
      const r = await fn();
      toast(r.msg, r.ok ? "ok" : "erro");
      depois?.(r);
      router.refresh();
    });

  return (
    <>
      <section className="card elev-sm">
        <div className="card-kicker">Lembretes</div>
        <div className="card-title" style={{ fontSize: 17 }}>Lembrete por e-mail na véspera</div>
        <button
          type="button"
          role="switch"
          aria-checked={lembretes}
          className="esc-switch"
          disabled={pending}
          onClick={() => exec(() => salvarLembretes(!lembretes))}
        >
          <span className="esc-switch-trilho" aria-hidden><span /></span>
          <span>
            <strong style={{ fontSize: 14 }}>{lembretes ? "Lembretes ligados" : "Lembretes desligados"}</strong>
            <span className="text-muted" style={{ display: "block", fontSize: 12.5 }}>
              {lembretes ? `Você recebe um e-mail em ${email} às vésperas dos seus dias no escritório.` : "Você não recebe o lembrete da véspera."}
            </span>
          </span>
        </button>
        <p className="text-muted" style={{ fontSize: 12.5, margin: 0 }}>
          Avisos de agendamento, de vaga na lista de espera e de mudança na escala são sempre enviados.
        </p>
      </section>

      <section className="card elev-sm">
        <div className="card-kicker">Google Agenda</div>
        <div className="card-title" style={{ fontSize: 17 }}>Seus dias na agenda</div>
        <div>
          {agendaAtiva ? (
            <StatusTag tipo="ok">Sincronização ativa</StatusTag>
          ) : (
            <StatusTag tipo="neutro">Ainda não ativada pelo RH</StatusTag>
          )}
        </div>
        <p className="text-muted" style={{ fontSize: 13, margin: 0, lineHeight: 1.5 }}>
          Os dias do seu grupo aparecem automaticamente na sua agenda do Google, e os dias que você agendar entram como
          convite para você.
        </p>
      </section>

      <section className="card elev-sm">
        <div className="card-kicker">Outros calendários</div>
        <div className="card-title" style={{ fontSize: 17 }}>Link do calendário (ICS)</div>
        <p className="text-muted" style={{ fontSize: 13, margin: 0, lineHeight: 1.5 }}>
          Para quem não usa o Google Agenda: adicione o link no Outlook, Apple Calendário ou similar. O link é pessoal —
          não compartilhe. Você pode revogá-lo quando quiser.
        </p>
        {icsCriadoEm && !link && (
          <span className="text-muted" style={{ fontSize: 12.5 }}>Link ativo, gerado em {horaSP(icsCriadoEm)}.</span>
        )}
        {link && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input className="input" readOnly value={link} style={{ flex: 1, minWidth: 220, fontSize: 12.5 }} onFocus={(e) => e.target.select()} />
            <button
              className="btn btn-secondary"
              onClick={() => navigator.clipboard.writeText(link).then(() => toast("Link copiado.", "ok"))}
            >
              Copiar
            </button>
          </div>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-primary" disabled={pending} onClick={() => exec(gerarFeedIcs, (r) => r.extra && setLink(r.extra))}>
            {icsCriadoEm ? "Gerar novo link" : "Gerar link"}
          </button>
          {icsCriadoEm && (
            <button className="btn btn-ghost" disabled={pending} onClick={() => exec(revogarFeedIcs, () => setLink(null))}>
              Revogar link
            </button>
          )}
        </div>
      </section>
    </>
  );
}
