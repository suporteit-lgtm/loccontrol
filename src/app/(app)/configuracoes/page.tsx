import { db } from "@/lib/db";
import { contexto, ehAdmin } from "@/lib/data";
import { googleConfigurado } from "@/lib/googleKey";
import { ConfigClient, type ModeloEmail } from "./ConfigClient";

export const dynamic = "force-dynamic";

export default async function ConfigPage() {
  const { usuario } = await contexto();
  // GOOGLE_SA_KEY (Vercel, JSON inteiro) OU GOOGLE_SA_KEY_JSON (arquivo local)
  const workspaceOk = googleConfigurado();
  const quarkOk = !!process.env.QUARKRH_TOKEN;
  const [{ data: tpl }, { data: eqs }, { data: modelo }] = await Promise.all([
    db().from("checklist_templates").select("lista, titulo").order("lista").order("ordem"),
    db().from("equipamentos_catalogo").select("nome, kit").order("ordem"),
    db().from("modelos_email").select("chave, assunto, corpo, anexo_nome").order("chave"),
  ]);
  return (
    <ConfigClient
      notif={usuario.notif}
      email={usuario.email}
      workspaceOk={workspaceOk}
      quarkOk={quarkOk}
      template={(tpl ?? []) as { lista: "rh" | "ti"; titulo: string }[]}
      equipamentos={(eqs ?? []) as { nome: string; kit: boolean }[]}
      modelos={(modelo ?? []) as ModeloEmail[]}
      admin={ehAdmin(usuario.papel)}
    />
  );
}
