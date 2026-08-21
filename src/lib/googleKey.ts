import { readFileSync } from "node:fs";
import path from "node:path";

export interface ChaveServico {
  client_email: string;
  private_key: string;
}

/**
 * Chave da service account do Google.
 * Na Vercel vem inteira na env GOOGLE_SA_KEY (conteúdo do JSON);
 * no PC local vem do arquivo apontado por GOOGLE_SA_KEY_JSON.
 */
export function chaveServico(): ChaveServico {
  if (process.env.GOOGLE_SA_KEY) return JSON.parse(process.env.GOOGLE_SA_KEY);
  const arquivo = path.resolve(process.cwd(), process.env.GOOGLE_SA_KEY_JSON!);
  return JSON.parse(readFileSync(arquivo, "utf8"));
}

export function googleConfigurado(): boolean {
  return (
    (!!process.env.GOOGLE_SA_KEY || !!process.env.GOOGLE_SA_KEY_JSON) &&
    !!process.env.GOOGLE_ADMIN_IMPERSONATE
  );
}
