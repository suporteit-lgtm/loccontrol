"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { dataLonga, maiuscula } from "@/lib/escala/formato";
import { duracao, minutos, type ReservaVista } from "@/lib/salas/regras";

export type ItemReserva = ReservaVista & { sala: string; local?: string | null; passou?: boolean; criadoPor?: string };

type Res = { ok: true } | { ok: false; erro: string };

/** Agendamentos agrupados por dia, com cancelar. `mostrarDono` na visão de quem gerencia. */
export function ListaReservas({
  itens,
  cancelar,
  hrefAgenda,
  mostrarDono = false,
  vazio = "Você não tem agendamentos.",
}: {
  itens: ItemReserva[];
  cancelar: (id: string) => Promise<Res>;
  hrefAgenda: string;
  mostrarDono?: boolean;
  vazio?: string;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [confirma, setConfirma] = useState<string | null>(null);
  const [pend, start] = useTransition();

  if (!itens.length)
    return (
      <div className="card elev-sm" style={{ textAlign: "center", padding: "var(--space-8)", gap: 10 }}>
        <div className="card-title">{vazio}</div>
        <Link href={hrefAgenda} className="btn btn-primary" style={{ alignSelf: "center" }}>
          Ver a agenda de salas →
        </Link>
      </div>
    );

  const dias = [...new Set(itens.map((i) => i.data))];
  const fazer = (id: string) =>
    start(async () => {
      const r = await cancelar(id);
      setConfirma(null);
      if (!r.ok) return toast(r.erro, "erro");
      toast("Agendamento cancelado. O horário ficou livre.", "ok");
      router.refresh();
    });

  return (
    <div className="card elev-sm" style={{ padding: "4px 20px 12px" }}>
      {dias.map((d) => (
        <div key={d}>
          <div className="sal-lista-dia">{maiuscula(dataLonga(d))}</div>
          <div className="esc-lista">
            {itens
              .filter((i) => i.data === d)
              .map((i) => (
                <div key={i.id} className="esc-linha" style={{ opacity: i.passou ? 0.55 : 1, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                    <strong style={{ fontSize: 14.5 }}>
                      {i.sala} · {i.ini}–{i.fim}
                      <span className="text-muted" style={{ fontWeight: 400, fontSize: 12.5 }}> ({duracao(minutos(i.fim) - minutos(i.ini))})</span>
                    </strong>
                    <span className="text-muted" style={{ fontSize: 13 }}>
                      {[i.titulo, mostrarDono ? `${i.nome} · ${i.email}` : null, i.local].filter(Boolean).join(" · ") || "Sem assunto"}
                      {mostrarDono && i.criadoPor && i.criadoPor !== i.email && ` · agendado por ${i.criadoPor}`}
                    </span>
                  </div>
                  {!i.passou &&
                    (confirma === i.id ? (
                      <span style={{ display: "flex", gap: 6 }}>
                        <button className="btn btn-secondary" style={{ height: 32, fontSize: 13 }} onClick={() => setConfirma(null)} disabled={pend}>
                          Manter
                        </button>
                        <button className="btn btn-danger" style={{ height: 32, fontSize: 13 }} onClick={() => fazer(i.id)} disabled={pend}>
                          {pend ? "Cancelando…" : "Sim, cancelar"}
                        </button>
                      </span>
                    ) : (
                      <button className="btn btn-secondary" style={{ height: 32, fontSize: 13, color: "var(--danger)" }} onClick={() => setConfirma(i.id)}>
                        Cancelar
                      </button>
                    ))}
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
