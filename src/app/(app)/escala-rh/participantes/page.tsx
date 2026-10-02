import { candidatos, participantes, unidadeDaEscala } from "@/lib/escala/rh";
import { ParticipantesClient } from "./ParticipantesClient";

export const dynamic = "force-dynamic";

export default async function ParticipantesPage() {
  const u = await unidadeDaEscala();
  const lista = await participantes(u.config.unidade_id);
  const cand = await candidatos(new Set(lista.filter((p) => p.ativo).map((p) => p.colaboradorId)));
  return (
    <ParticipantesClient
      unidade={`${u.cidade} · ${u.unidade}`}
      cidadePadrao={u.cidade}
      unidadePadrao={u.unidade}
      capacidade={u.config.capacidade}
      grupoInicial={u.config.grupo_inicial}
      grupos={u.grupos}
      participantes={lista}
      candidatos={cand}
    />
  );
}
