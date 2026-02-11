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
    return new Response(JSON.stringify({ error: "Missing Supabase env vars" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
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
    const clubId = String(body?.club_id || "").trim();
    const userId = String(body?.user_id || "").trim();
    const deleteUser = !!body?.delete_user;

    if (!clubId || !userId) {
      return new Response(
        JSON.stringify({ error: "club_id and user_id are required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const { error: delError } = await serviceClient
      .from("club_staff")
      .delete()
      .eq("club_id", clubId)
      .eq("user_id", userId);

    if (delError) {
      return new Response(JSON.stringify({ error: delError.message }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (deleteUser) {
      const { error: authDelError } = await serviceClient.auth.admin.deleteUser(
        userId,
      );
      if (authDelError) {
        return new Response(
          JSON.stringify({ error: authDelError.message || "Could not delete user" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
    }

    return new Response(
      JSON.stringify({ ok: true, deleted: true, user_id: userId }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
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
