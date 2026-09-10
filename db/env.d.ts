declare namespace Cloudflare {
  interface Env {
    DATABASE_URL?: string;
    SUPABASE_URL?: string;
    SUPABASE_ANON_KEY?: string;
    SUPABASE_SERVICE_ROLE_KEY?: string;
    DEV_TEST_LOGIN?: string;
  }
}
