import { contaPortal } from "@/lib/escala/auth";
import { agendaDoDia, reservasDe } from "@/lib/salas/servico";
import { hojeSP } from "@/lib/escala/calendario";
import { MinhasPortal } from "@/components/salas/MinhasPortal";
import { EmPreparacao } from "@/components/salas/EmPreparacao";
import { cancelarSalaPortal, reservarSalaPortal } from "../../actions";

export const dynamic = "force-dynamic";

export default async function MinhasSalasPage() {
  const conta = (await contaPortal())!;
  const [hoje, itens] = await Promise.all([agendaDoDia(hojeSP(), conta.email), reservasDe(conta.email, 30)]);
  if (!hoje.instalado) return <EmPreparacao />;
  return (
    <MinhasPortal
      itens={itens}
      hoje={hoje.hoje}
      agoraMin={hoje.agoraMin}
      config={hoje.config}
      salas={hoje.salas}
      reservasHoje={hoje.reservas}
      reservar={reservarSalaPortal}
      cancelar={cancelarSalaPortal}
    />
  );
}
