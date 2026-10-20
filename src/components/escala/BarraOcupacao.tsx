/** Barra de ocupação do dia (verde → amarelo → vermelho conforme enche). Portal e RH. */
export function BarraOcupacao({ n, de }: { n: number; de: number }) {
  const p = de > 0 ? Math.max(0, Math.min(100, Math.round((n / de) * 100))) : 0;
  const cor = p >= 100 ? "var(--danger)" : p >= 85 ? "var(--warn-forte)" : "var(--ok)";
  return (
    <span className="esc-barra" role="img" aria-label={`${n} de ${de} lugares ocupados`} title={`${n} de ${de} lugares ocupados`}>
      <span style={{ width: `${p}%`, background: cor }} />
    </span>
  );
}
