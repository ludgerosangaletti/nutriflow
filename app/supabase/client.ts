"use client";

import { createBrowserClient } from "@supabase/ssr";

// A URL e a chave publicável fazem parte da configuração pública do cliente.
// Sites injeta variáveis no Worker em runtime, mas o navegador precisa destes
// valores no bundle gerado durante o build.
const SUPABASE_URL = "https://rtskdxozqhdlnssnetjt.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_Dp8f1FZfTyXDwVrp3yA_1w_Hki6J-Qe";

export function createClient() {
  return createBrowserClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
  );
}
