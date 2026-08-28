import { db } from "@/lib/db";
import { contexto, ehAdmin, veRH, veTI } from "@/lib/data";
import { AjudaClient } from "./AjudaClient";

export const dynamic = "force-dynamic";

export default async function AjudaPage() {
  const { usuario } = await contexto();
  const { data } = await db().from("ajuda_videos").select("chave, url");
  const videos = Object.fromEntries((data ?? []).map((v) => [v.chave, v.url as string]));

  return (
    <AjudaClient
      videos={videos}
      admin={ehAdmin(usuario.papel)}
      // guias do RH: admins + Usuário RH; guias da TI: admins + Usuário T.I;
      // a seção Geral aparece para todos
      mostraRH={veRH(usuario.papel)}
      mostraTI={veTI(usuario.papel)}
    />
  );
}
