import { db } from "./db";

export interface AuditEntrada {
  pessoa?: string;
  ator: string;
  tabela: string;
  campo: string;
  antes?: string;
  depois?: string;
}

/** Grava uma linha na trilha imutável de auditoria. */
export async function auditar(e: AuditEntrada) {
  await db().from("auditoria").insert({
    pessoa: e.pessoa ?? "—",
    ator: e.ator,
    tabela: e.tabela,
    campo: e.campo,
    antes: e.antes ?? "—",
    depois: e.depois ?? "—",
  });
}
