import { redirect } from "next/navigation";
import { usuarioAtual, ehAdmin } from "@/lib/session";
import { lerConfig, listarSalas } from "@/lib/salas/servico";
import { PageHeader } from "@/components/ui";
import { CadastroSalasClient } from "./CadastroSalasClient";

export const dynamic = "force-dynamic";

export default async function CadastroSalasPage() {
  const u = await usuarioAtual();
  if (!u) redirect("/login");
  if (!ehAdmin(u.papel)) redirect("/agenda-salas");
  const [salas, { config }] = await Promise.all([listarSalas(true), lerConfig()]);
  return (
    <>
      <PageHeader eyebrow="Salas" titulo="Cadastro de salas" sub="As salas que aparecem na agenda e as regras de agendamento." />
      <CadastroSalasClient salas={salas} config={config} />
    </>
  );
}
