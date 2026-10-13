import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * A entrada é o login: ele já mostra o LocControl e, com a Escala liberada,
 * o cartão do portal do colaborador. Quem já está logado o login manda para o painel.
 */
export default function Home() {
  redirect("/login");
}
