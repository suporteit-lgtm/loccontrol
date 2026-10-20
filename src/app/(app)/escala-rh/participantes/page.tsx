import { candidatos, participantes, unidadeDaEscala } from "@/lib/escala/rh";
import { ParticipantesClient } from "./ParticipantesClient";
import { diaDaSemana, grupoFixo, hojeSP, segundaDaSemana, somarDias } from "@/lib/escala/calendario";

export const dynamic = "force-dynamic";

export default async function ParticipantesPage() {
  const u = await unidadeDaEscala();
  const lista = await participantes(u.config.unidade_id);
  const cand = await candidatos(new Set(lista.filter((p) => p.ativo).map((p) => p.colaboradorId)));
  // quem vem na segunda desta semana (no fim de semana, da próxima)
  const hoje = hojeSP();
  const seg = [0, 6].includes(diaDaSemana(hoje)) ? somarDias(segundaDaSemana(hoje), 7) : segundaDaSemana(hoje);
  const segundaAgora = grupoFixo(seg, { ancora: u.config.data_ancora ?? seg, grupoInicial: u.config.grupo_inicial }) ?? u.config.grupo_inicial;
  return (
    <ParticipantesClient
      unidade={`${u.cidade} · ${u.unidade}`}
      cidadePadrao={u.cidade}
      unidadePadrao={u.unidade}
      capacidade={u.config.capacidade}
      grupoInicial={segundaAgora}
      grupos={u.grupos}
      participantes={lista}
      candidatos={cand}
    />
  );
}
