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
    const userId = String(body?.user_id || "").trim();
    const email = body?.email ? String(body.email).trim().toLowerCase() : null;
    const firstName = body?.first_name ? String(body.first_name).trim() : null;
    const lastName = body?.last_name ? String(body.last_name).trim() : null;
    const phone = body?.phone ? String(body.phone).trim() : null;

    if (!userId) {
      return new Response(JSON.stringify({ error: "user_id is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const update: any = {};
    if (email) update.email = email;

    const userMetadata: any = {};
    if (firstName !== null) userMetadata.first_name = firstName;
    if (lastName !== null) userMetadata.last_name = lastName;
    if (phone !== null) userMetadata.phone = phone;
    if (Object.keys(userMetadata).length > 0) update.user_metadata = userMetadata;

    if (Object.keys(update).length === 0) {
      return new Response(JSON.stringify({ error: "No fields to update" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data, error } = await serviceClient.auth.admin.updateUserById(
      userId,
      update,
    );

    if (error || !data?.user) {
      return new Response(
        JSON.stringify({ error: error?.message || "Could not update staff" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({ ok: true, user_id: userId, email: data.user.email }),
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
