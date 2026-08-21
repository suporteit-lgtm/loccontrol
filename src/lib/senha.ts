import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/** Hash de senha com scrypt (nativo do Node — sem dependência externa). */
export function hashSenha(senha: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(senha, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export function verificarSenha(senha: string, armazenado: string | null): boolean {
  if (!armazenado) return false;
  const [algo, salt, hash] = armazenado.split(":");
  if (algo !== "scrypt" || !salt || !hash) return false;
  const calculado = scryptSync(senha, salt, 64);
  const esperado = Buffer.from(hash, "hex");
  return calculado.length === esperado.length && timingSafeEqual(calculado, esperado);
}

export function senhaValida(senha: string): string | null {
  if (senha.length < 8) return "A senha precisa de pelo menos 8 caracteres";
  return null;
}
