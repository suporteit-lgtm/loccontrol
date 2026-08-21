"use client";

// Máscaras de digitação usadas em todo o sistema.
// A máscara age no que a pessoa digita; o valor guardado é o texto formatado.

export function mascaraCpf(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length > 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  if (d.length > 6) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  if (d.length > 3) return `${d.slice(0, 3)}.${d.slice(3)}`;
  return d;
}

export function mascaraTelefone(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length > 10) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`; // celular
  if (d.length > 6) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`; // fixo
  if (d.length > 2) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length > 0) return `(${d}`;
  return d;
}

export function mascaraData(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 8);
  if (d.length > 4) return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
  if (d.length > 2) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return d;
}

/** E-mail: minúsculas, sem espaços ou acentos. */
export function mascaraEmail(v: string): string {
  return v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[\s]/g, "");
}

export function cpfValido(v: string): boolean {
  const d = v.replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (base: number) => {
    let soma = 0;
    for (let i = 0; i < base; i++) soma += parseInt(d[i]) * (base + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return dv(9) === parseInt(d[9]) && dv(10) === parseInt(d[10]);
}

export function emailValido(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export type TipoMascara = "cpf" | "telefone" | "data" | "email" | "nenhuma";

export function aplicarMascara(tipo: TipoMascara, v: string): string {
  switch (tipo) {
    case "cpf":
      return mascaraCpf(v);
    case "telefone":
      return mascaraTelefone(v);
    case "data":
      return mascaraData(v);
    case "email":
      return mascaraEmail(v);
    default:
      return v;
  }
}

/** Input com máscara e validação visual (borda âmbar quando incompleto/ inválido). */
export function InputMascarado({
  tipo,
  value,
  onChange,
  ...resto
}: {
  tipo: TipoMascara;
  value: string;
  onChange: (v: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value">) {
  const invalido =
    value.trim().length > 0 &&
    ((tipo === "cpf" && !cpfValido(value)) ||
      (tipo === "email" && !emailValido(value)) ||
      (tipo === "data" && !/^\d{2}\/\d{2}\/\d{4}$/.test(value)) ||
      (tipo === "telefone" && value.replace(/\D/g, "").length < 10));

  return (
    <input
      {...resto}
      className={resto.className ?? "input"}
      inputMode={tipo === "email" ? "email" : tipo === "nenhuma" ? undefined : "numeric"}
      value={value}
      onChange={(e) => onChange(aplicarMascara(tipo, e.target.value))}
      style={{
        fontFamily: tipo === "nenhuma" ? undefined : "var(--mono)",
        ...(resto.style ?? {}),
        ...(invalido ? { borderColor: "var(--warn)" } : {}),
      }}
      title={invalido ? "Valor incompleto ou inválido" : resto.title}
    />
  );
}
