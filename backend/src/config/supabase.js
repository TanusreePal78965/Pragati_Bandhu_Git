const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
// Use the service role key so backend operations bypass RLS.
// Auth is already enforced by the JWT middleware — RLS is redundant server-side.
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const isConfigured =
  supabaseUrl &&
  supabaseServiceKey &&
  supabaseUrl.startsWith('http') &&
  supabaseUrl !== 'your_supabase_url';

if (!isConfigured) {
  console.warn(
    '[Supabase] Credentials not configured — data routes will return 503 until SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env'
  );
}

// Export a proxy so routes fail gracefully at request time rather than crashing at startup
const supabase = isConfigured
  ? createClient(supabaseUrl, supabaseServiceKey)
  : new Proxy(
      {},
      {
        get: () => () => {
          throw new Error('Supabase is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY in .env');
        },
      }
    );

module.exports = supabase;
