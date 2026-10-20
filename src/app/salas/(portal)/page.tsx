import { contaPortal } from "@/lib/escala/auth";
import { hojeSP, segundaDaSemana, somarDias } from "@/lib/escala/calendario";
import { agendaDoDia, reservasDe, reservasEntre } from "@/lib/salas/servico";
import { AgendaPortal } from "@/components/salas/AgendaPortal";
import { EmPreparacao } from "@/components/salas/EmPreparacao";
import { cancelarSalaPortal, reservarSalaPortal } from "../actions";

export const dynamic = "force-dynamic";

export default async function AgendaSalasPage({ searchParams }: { searchParams: Promise<{ data?: string }> }) {
  const conta = (await contaPortal())!;
  const { data: q } = await searchParams;
  const data = q && /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : hojeSP();
  const seg = segundaDaSemana(data);
  const [a, semana, minhas] = await Promise.all([
    agendaDoDia(data, conta.email),
    reservasEntre(seg, somarDias(seg, 4), conta.email).catch(() => []),
    reservasDe(conta.email).catch(() => []),
  ]);
  if (!a.instalado) return <EmPreparacao />;

  return (
    <AgendaPortal
      data={data}
      hoje={a.hoje}
      agoraMin={a.agoraMin}
      config={a.config}
      salas={a.salas}
      reservas={a.reservas}
      semana={semana}
      minhas={minhas}
      reservar={reservarSalaPortal}
      cancelar={cancelarSalaPortal}
    />
  );
}
