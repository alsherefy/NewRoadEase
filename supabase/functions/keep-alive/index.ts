import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Critical Edge Functions that should be kept warm
const CRITICAL_FUNCTIONS = [
  'dashboard',
  'work-orders',
  'customers',
  'invoices',
  'technicians',
  'settings',
  'inventory',
  'users'
];

// Simple in-memory cache for last ping times
const lastPingTimes = new Map<string, number>();
const PING_COOLDOWN = 5 * 60 * 1000; // 5 minutes

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 200,
        headers: corsHeaders,
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'ping';

    if (action === 'status') {
      // Return status of all functions
      const status = CRITICAL_FUNCTIONS.map(fn => ({
        function: fn,
        lastPing: lastPingTimes.get(fn) || null,
        status: lastPingTimes.get(fn) ? 'warm' : 'cold'
      }));

      return new Response(
        JSON.stringify({ status, timestamp: Date.now() }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    if (action === 'ping') {
      const now = Date.now();
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Missing Supabase configuration');
      }

      const results = [];

      // Ping each critical function
      for (const functionName of CRITICAL_FUNCTIONS) {
        const lastPing = lastPingTimes.get(functionName) || 0;
        
        // Skip if we pinged recently (within cooldown)
        if (now - lastPing < PING_COOLDOWN) {
          results.push({
            function: functionName,
            status: 'skipped',
            reason: 'recently pinged',
            lastPing
          });
          continue;
        }

        try {
          const functionUrl = `${supabaseUrl}/functions/v1/${functionName}`;
          
          // Send a lightweight HEAD request (or GET with minimal data)
          const response = await fetch(functionUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${supabaseAnonKey}`,
              'Content-Type': 'application/json',
            },
            signal: AbortSignal.timeout(5000), // 5 second timeout
          });

          // Update last ping time
          lastPingTimes.set(functionName, now);

          results.push({
            function: functionName,
            status: 'success',
            statusCode: response.status,
            timestamp: now
          });
        } catch (error) {
          results.push({
            function: functionName,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: now
          });
        }
      }

      return new Response(
        JSON.stringify({
          message: 'Keep-alive ping completed',
          results,
          timestamp: now
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Use ?action=ping or ?action=status' }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Keep-alive error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error'
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
