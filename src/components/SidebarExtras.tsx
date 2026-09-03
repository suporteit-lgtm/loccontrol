"use client";

import { createContext, useContext, useState, useEffect, type Dispatch, type SetStateAction } from "react";

export interface SidebarExtras {
  /** Rota do item de menu embaixo do qual isso deve aparecer. */
  rota: string;
  node: React.ReactNode;
}

// dois contexts separados (não um só com { extras, setExtras }) de propósito:
// setExtras (do useState) é sempre a mesma função entre renders, mas um objeto
// { extras, setExtras } novo a cada render do Provider NÃO é — quem lesse esse
// objeto só pra pegar o setExtras (como usePaginaExtrasNoMenu, abaixo) ia
// re-renderizar toda vez que "extras" mudasse, chamava setExtras nesse
// re-render, mudava "extras" de novo... loop infinito ("Maximum update depth
// exceeded"), e é isso que deixava os cliques na fila do RH bugados.
const ExtrasCtx = createContext<SidebarExtras | null>(null);
const SetExtrasCtx = createContext<Dispatch<SetStateAction<SidebarExtras | null>>>(() => {});

export function SidebarExtrasProvider({ children }: { children: React.ReactNode }) {
  const [extras, setExtras] = useState<SidebarExtras | null>(null);
  return (
    <SetExtrasCtx.Provider value={setExtras}>
      <ExtrasCtx.Provider value={extras}>{children}</ExtrasCtx.Provider>
    </SetExtrasCtx.Provider>
  );
}

export function useSidebarExtras() {
  return { extras: useContext(ExtrasCtx), setExtras: useContext(SetExtrasCtx) };
}

/**
 * Uma página chama isso pra colocar controles embaixo do próprio item no
 * menu lateral, em vez de num cabeçalho — some quando a página desmonta
 * (ou é substituído se outra página botar o dela primeiro).
 */
export function usePaginaExtrasNoMenu(rota: string, node: React.ReactNode) {
  // só o contexto do setExtras (referência estável) — nunca o de "extras",
  // senão volta o loop explicado acima
  const setExtras = useContext(SetExtrasCtx);
  useEffect(() => {
    setExtras({ rota, node });
    return () => setExtras((atual) => (atual?.rota === rota ? null : atual));
  }, [rota, node, setExtras]);
}
