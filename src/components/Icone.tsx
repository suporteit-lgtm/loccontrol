// Ícones em SVG stroke — mesmos paths do protótipo.
const PATHS: Record<string, string[]> = {
  dash: ["M3 3h7v7H3z", "M14 3h7v7h-7z", "M14 14h7v7h-7z", "M3 14h7v7H3z"],
  colabs: [
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",
    "M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8",
    "M22 21v-2a4 4 0 0 0-3-3.87",
    "M16 3.13a4 4 0 0 1 0 7.75",
  ],
  wizard: [
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",
    "M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8",
    "M19 8v6",
    "M22 11h-6",
  ],
  matriz: ["M3 3h18v18H3z", "M3 9h18", "M3 15h18", "M9 3v18", "M15 3v18"],
  grupos: ["M2 4h20v16H2z", "m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"],
  fila: [
    "M22 12h-6l-2 3h-4l-2-3H2",
    "M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z",
  ],
  restrita: [
    "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",
    "M12 8v4",
    "M12 16h.01",
  ],
  auditoria: ["M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8", "M3 3v5h5", "M12 7v5l4 2"],
  config: [
    "M21 4h-7", "M10 4H3", "M21 12h-9", "M8 12H3", "M21 20h-5", "M12 20H3",
    "M14 2v4", "M8 10v4", "M16 18v4",
  ],
  sair: ["M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4", "M16 17l5-5-5-5", "M21 12H9"],
  filarh: ["M8 6h13", "M8 12h13", "M8 18h13", "M3 6h.01", "M3 12h.01", "M3 18h.01"],
  dashti: ["M3 3h7v7H3z", "M14 3h7v7h-7z", "M14 14h7v7h-7z", "M3 14h7v7H3z"],
  unidades: [
    "M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0",
    "M12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6",
  ],
  usuarios: [
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",
    "M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8",
    "m16 11 2 2 4-4",
  ],
  membros: [
    "M18 21a8 8 0 0 0-16 0",
    "M10 3a5 5 0 1 0 0 10 5 5 0 0 0 0-10",
    "M22 20c0-3.37-2-6.5-4-8",
  ],
  sol: [
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8", "M12 2v2", "M12 20v2",
    "m4.93 4.93 1.41 1.41", "m17.66 17.66 1.41 1.41", "M2 12h2", "M20 12h2",
    "m6.34 17.66-1.41 1.41", "m19.07 4.93-1.41 1.41",
  ],
  lua: ["M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"],
  chevron: ["m6 9 6 6 6-6"],
  limpar: ["M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8", "M3 3v5h5"],
  "sidebar-collapse": ["m15 18-6-6 6-6"],
  "sidebar-expand": ["m9 18 6-6-6-6"],
};

export function Icone({ nome, tamanho = 16 }: { nome: string; tamanho?: number }) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flex: "none" }}
    >
      {(PATHS[nome] ?? []).map((d, i) => (
        <path d={d} key={i} />
      ))}
    </svg>
  );
}
