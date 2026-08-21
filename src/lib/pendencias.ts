// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  Pendências — o que falta ser informado, revisado ou liberado            ║
// ║                                                                          ║
// ║  Alimenta os chips das filas do RH e da TI: em vez de abrir o card para  ║
// ║  descobrir o que falta, a fila já mostra.                                ║
// ╚══════════════════════════════════════════════════════════════════════════╝

import type { Colaborador } from "./types";

/** Campo em branco ou com o traço que a importação usa como "vazio". */
function vazio(v: string | null | undefined): boolean {
  const s = (v ?? "").trim();
  return !s || s === "—" || s === "-";
}

/**
 * O que o RH precisa revisar/completar antes de aprovar.
 * `temDocumento` vem da tabela de documentos (contrato anexado).
 */
export function pendenciasRH(c: Colaborador, temDocumento: boolean): string[] {
  const p: string[] = [];
  if (vazio(c.cpf)) p.push("CPF");
  if (vazio(c.cargo)) p.push("cargo");
  if (vazio(c.dept)) p.push("departamento");
  if (vazio(c.telefone)) p.push("telefone");
  if (vazio(c.unidade)) p.push("unidade");
  if (!c.admissao) p.push("data de admissão");
  if (!temDocumento) p.push("contrato");
  return p;
}

/**
 * O que a TI precisa informar/liberar para ativar o colaborador.
 * `acessos` é a lista já resolvida (seleção do RH ou matriz do cargo).
 */
export function pendenciasTI(c: Colaborador | undefined, acessos: string[]): string[] {
  if (!c) return [];
  const p: string[] = [];
  if (vazio(c.email)) p.push("informar e-mail corporativo");
  if (acessos.length) p.push(`liberar ${acessos.length} acesso(s)`);
  if (c.grupos?.length) p.push(`aplicar ${c.grupos.length} grupo(s)`);
  if (c.equipamentos?.length) p.push(`separar ${c.equipamentos.length} equipamento(s)`);
  return p;
}
