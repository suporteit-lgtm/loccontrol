import { db } from "@/lib/db";
import { contaPortal } from "@/lib/escala/auth";
import { lerModos } from "@/lib/escala/envio";
import { PreferenciasClient } from "./PreferenciasClient";

export const dynamic = "force-dynamic";

export default async function EscalaPreferencias() {
  const conta = await contaPortal();
  const p = conta?.participante;
  if (!p?.ativo) return null;

  const [{ data: pref }, modos] = await Promise.all([
    db().from("escala_preferencia").select("lembretes, ics_criado_em").eq("participante_id", p.id).maybeSingle(),
    lerModos(),
  ]);
  return (
    <div className="esc-estreito">
    <PreferenciasClient
      email={conta!.email}
      lembretes={pref?.lembretes ?? true}
      icsCriadoEm={pref?.ics_criado_em ?? null}
      agendaAtiva={modos.modo_google !== "DESLIGADO"}
    />
    </div>
  );
}
