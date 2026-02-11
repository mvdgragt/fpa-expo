import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabaseUrl =
    Deno.env.get("EDGE_SUPABASE_URL") || Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey =
    Deno.env.get("EDGE_SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseServiceRoleKey =
    Deno.env.get("EDGE_SUPABASE_SERVICE_ROLE_KEY") ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return new Response(
      JSON.stringify({ error: "Missing Supabase env vars" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const authHeader = req.headers.get("Authorization") || "";

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey);

  try {
    const { data: adminCheck, error: adminError } =
      await userClient.rpc("is_admin_user");

    if (adminError || !adminCheck) {
      return new Response(JSON.stringify({ error: "not allowed" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const clubIdRaw = body?.club_id;
    const clubId = clubIdRaw ? String(clubIdRaw).trim() : "";

    let q = serviceClient
      .from("club_staff")
      .select("user_id,club_id,created_at")
      .order("created_at", { ascending: false });
    if (clubId) q = q.eq("club_id", clubId);

    const { data: staffRows, error: staffError } = await q;

    if (staffError) {
      return new Response(JSON.stringify({ error: staffError.message }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const rows = (staffRows || []) as {
      user_id: string;
      club_id: string;
      created_at: string;
    }[];

    const users = await Promise.all(
      rows.map(async (r) => {
        const { data, error } = await serviceClient.auth.admin.getUserById(
          r.user_id,
        );
        if (error || !data?.user) {
          return {
            user_id: r.user_id,
            club_id: r.club_id,
            created_at: r.created_at,
            email: null,
            first_name: null,
            last_name: null,
            phone: null,
          };
        }
        const meta = (data.user.user_metadata || {}) as any;
        return {
          user_id: r.user_id,
          club_id: r.club_id,
          created_at: r.created_at,
          email: data.user.email || null,
          first_name: meta.first_name || null,
          last_name: meta.last_name || null,
          phone: meta.phone || null,
        };
      }),
    );

    return new Response(JSON.stringify({ ok: true, staff: users }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as any)?.message || String(e) }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
});
