"use client";

import { createContext, useContext, useState, useEffect, type Dispatch, type SetStateAction } from "react";

export interface SidebarExtras {
  /** Rota do item de menu embaixo do qual isso deve aparecer. */
  rota: string;
  node: React.ReactNode;
}

const Ctx = createContext<{
  extras: SidebarExtras | null;
  setExtras: Dispatch<SetStateAction<SidebarExtras | null>>;
}>({ extras: null, setExtras: () => {} });

export function SidebarExtrasProvider({ children }: { children: React.ReactNode }) {
  const [extras, setExtras] = useState<SidebarExtras | null>(null);
  return <Ctx.Provider value={{ extras, setExtras }}>{children}</Ctx.Provider>;
}

export function useSidebarExtras() {
  return useContext(Ctx);
}

/**
 * Uma página chama isso pra colocar controles embaixo do próprio item no
 * menu lateral, em vez de num cabeçalho — some quando a página desmonta
 * (ou é substituído se outra página botar o dela primeiro).
 */
export function usePaginaExtrasNoMenu(rota: string, node: React.ReactNode) {
  const { setExtras } = useSidebarExtras();
  useEffect(() => {
    setExtras({ rota, node });
    return () => setExtras((atual) => (atual?.rota === rota ? null : atual));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rota, node]);
}
