import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Cliente admin (service_role) — usado SOMENTE no servidor.
// As permissões de papel são aplicadas na camada de aplicação (src/lib/perms.ts);
// as políticas de RLS ficam prontas para o SSO real (ver 0002_rls.sql).
let _db: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (_db) return _db;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase não configurado: defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env (veja .env.example)."
    );
  }
  _db = createClient(url, key, { auth: { persistSession: false } });
  return _db;
}
