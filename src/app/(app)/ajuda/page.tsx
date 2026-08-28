import { db } from "@/lib/db";
import { contexto, ehAdmin } from "@/lib/data";
import { AjudaClient } from "./AjudaClient";

export const dynamic = "force-dynamic";

export default async function AjudaPage() {
  const { usuario } = await contexto();
  const { data } = await db().from("ajuda_videos").select("chave, url");
  const videos = Object.fromEntries((data ?? []).map((v) => [v.chave, v.url as string]));

  return <AjudaClient videos={videos} admin={ehAdmin(usuario.papel)} />;
}
