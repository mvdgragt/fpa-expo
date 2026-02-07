import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

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
    const clubId = String(body?.club_id || "").trim();
    const firstName = String(body?.first_name || "").trim();
    const lastName = String(body?.last_name || "").trim();
    const email = String(body?.email || "")
      .trim()
      .toLowerCase();
    const phone = body?.phone ? String(body.phone).trim() : null;

    if (!clubId || !firstName || !lastName || !email) {
      return new Response(
        JSON.stringify({
          error: "club_id, first_name, last_name, email are required",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const { data: created, error: createError } =
      await serviceClient.auth.admin.inviteUserByEmail(email, {
        data: {
          first_name: firstName,
          last_name: lastName,
          phone: phone || null,
        },
      });

    if (createError || !created?.user?.id) {
      return new Response(
        JSON.stringify({
          error: createError?.message || "Could not invite auth user",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const userId = created.user.id;

    const { error: staffError } = await serviceClient
      .from("club_staff")
      .insert({ user_id: userId, club_id: clubId });

    if (staffError) {
      await serviceClient.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({
          error: staffError.message || "Could not attach staff to club",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({ ok: true, invited: true, user_id: userId, email }),
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
