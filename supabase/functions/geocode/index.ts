import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { address } = await req.json();

    if (!address || typeof address !== "string") {
      return new Response(
        JSON.stringify({ error: "Address is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&countrycodes=fr`;

    const response = await fetch(url, {
      headers: { "User-Agent": "BatiFlow/1.0" },
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: "Geocoding service error" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results = await response.json();

    if (!results || results.length === 0) {
      return new Response(
        JSON.stringify({ lat: null, lng: null, found: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { lat, lon, display_name } = results[0];

    return new Response(
      JSON.stringify({
        lat: parseFloat(lat),
        lng: parseFloat(lon),
        display_name,
        found: true,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
