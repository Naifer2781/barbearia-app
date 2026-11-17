import { createClient } from "@supabase/supabase-js";

// Fallback direto para funcionar imediatamente ao publicar.
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://murstjlutzkfdnropdlg.supabase.co";
const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_UpcKe1H4Vq5UonW_iPSkkw__wI7WlHn";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});
