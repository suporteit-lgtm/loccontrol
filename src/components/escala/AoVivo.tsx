"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Mantém as telas da Escala atualizadas sem F5: busca os dados de novo a cada
 * `segundos` enquanto a aba está visível, e na hora em que a pessoa volta para
 * a aba. O que a tela guarda no navegador (folha aberta, filtros) não se perde.
 */
export function AoVivo({ segundos = 10 }: { segundos?: number }) {
  const router = useRouter();
  useEffect(() => {
    const atualizar = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const id = window.setInterval(atualizar, segundos * 1000);
    document.addEventListener("visibilitychange", atualizar);
    window.addEventListener("focus", atualizar);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", atualizar);
      window.removeEventListener("focus", atualizar);
    };
  }, [router, segundos]);
  return null;
}
