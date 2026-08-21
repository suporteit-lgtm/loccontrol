import { db } from "@/lib/db";
import { contexto, ehAdmin, unidadesMap } from "@/lib/data";
import { ehAdminTI } from "@/lib/perms";
import { UsuariosClient } from "./UsuariosClient";
import type { Usuario } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const { usuario } = await contexto("ti");
  // colunas explícitas: o hash de senha NUNCA vai para o navegador
  const [{ data }, mapa] = await Promise.all([
    db()
      .from("usuarios")
      .select("id, nome, email, papel, status, superadmin, ultimo_acesso, solicitado_em, notif, unidades_acesso, senha_hash")
      .order("nome"),
    unidadesMap(),
  ]);
  const usuarios = (data ?? []).map(({ senha_hash, ...u }) => ({
    ...u,
    temSenha: !!senha_hash,
  }));
  return (
    <UsuariosClient
      usuarios={usuarios as (Usuario & { temSenha: boolean })[]}
      admin={ehAdmin(usuario.papel)}
      podeSenha={ehAdminTI(usuario.papel)}
      unidadesMap={mapa}
    />
  );
}
