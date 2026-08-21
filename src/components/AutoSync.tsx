"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { tick, novasNotificacoes } from "@/app/actions/sync";
import { useToast } from "./Toast";

const INTERVALO_MS = 30_000;
const CHAVE_ULTIMA = "lc-notif-ultima";

/**
 * Mantém o sistema em dia sozinho: a cada 30s dispara um ciclo de
 * sincronização com o Workspace e recarrega os dados da tela — sem botão,
 * sem recarregar a página inteira.
 *
 * Continua rodando com a aba em segundo plano: o ciclo não serve só para
 * atualizar a tela — ele também despacha os e-mails programados, que não podem
 * ficar esperando alguém olhar para o monitor. O que é pulado com a aba oculta
 * é apenas o `router.refresh()`, que não teria para quem renderizar.
 *
 * O navegador afrouxa os timers de abas ocultas (~1x por minuto), o que é
 * suficiente: o trabalho de verdade é limitado pelos intervalos do servidor.
 */
export function AutoSync() {
  const router = useRouter();
  const { toast } = useToast();
  const rodando = useRef(false);
  const [estado, setEstado] = useState<"ok" | "sincronizando" | "erro">("ok");

  useEffect(() => {
    let vivo = true;

    // pede a permissão de notificações do navegador uma única vez
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      void Notification.requestPermission();
    }

    /** Entrega as notificações novas; devolve true se alguma foi mostrada. */
    const entregarNotificacoes = async (): Promise<boolean> => {
      let desde = 0;
      try {
        desde = Number(localStorage.getItem(CHAVE_ULTIMA) ?? "0");
      } catch {}
      const r = await novasNotificacoes(desde);
      if (!vivo) return false;
      try {
        localStorage.setItem(CHAVE_ULTIMA, String(r.ultimo));
      } catch {}
      // primeira visita: só marca o ponteiro, não despeja o histórico
      if (desde === 0) return false;
      for (const n of r.itens.slice(-5)) {
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          new Notification(n.titulo, { body: n.corpo, icon: "/favicon.png", tag: `lc-${n.id}` });
        } else {
          toast(`${n.titulo} — ${n.corpo}`);
        }
      }
      return r.itens.length > 0;
    };

    const ciclo = async () => {
      if (!vivo || rodando.current) return;
      rodando.current = true;
      setEstado("sincronizando");
      try {
        const r = await tick();
        if (!vivo) return;
        setEstado(r.ok ? "ok" : "erro");
        const notificou = await entregarNotificacoes();
        // recarrega a tela só quando algo mudou de verdade E há alguém vendo —
        // um refresh a cada 30s deixa a navegação pesada sem trazer novidade
        if ((r.mudou || notificou) && !document.hidden) router.refresh();
      } catch {
        if (vivo) setEstado("erro");
      } finally {
        rodando.current = false;
      }
    };

    const t = setInterval(ciclo, INTERVALO_MS);
    const aoVoltar = () => {
      if (!document.hidden) void ciclo();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    void ciclo(); // primeiro ciclo assim que a tela abre

    return () => {
      vivo = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [router, toast]);

  // indicador discreto no canto — some quando está tudo em dia
  if (estado === "ok") return null;

  return (
    <div
      aria-live="polite"
      style={{
        position: "fixed",
        bottom: 12,
        right: 14,
        zIndex: 40,
        display: "flex",
        alignItems: "center",
        gap: 7,
        fontSize: 11,
        fontFamily: "var(--mono)",
        color: estado === "erro" ? "var(--danger-forte)" : "var(--color-neutral-600)",
        background: "var(--color-surface)",
        border: "1px solid var(--color-divider)",
        borderRadius: 999,
        padding: "4px 11px",
        opacity: 0.9,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: estado === "erro" ? "var(--danger)" : "var(--color-accent)",
          animation: estado === "sincronizando" ? "skel 1s infinite" : "none",
        }}
      />
      {estado === "erro" ? "falha ao sincronizar" : "sincronizando"}
    </div>
  );
}
