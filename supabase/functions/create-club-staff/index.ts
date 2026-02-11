import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  console.log("[create-club-staff] request", {
    method: req.method,
    hasAuth: !!req.headers.get("Authorization"),
  });

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
    console.error("[create-club-staff] missing env vars", {
      hasUrl: !!supabaseUrl,
      hasAnon: !!supabaseAnonKey,
      hasServiceRole: !!supabaseServiceRoleKey,
    });
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
      console.error("[create-club-staff] not allowed", {
        adminCheck,
        adminError: adminError?.message || null,
      });
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
      console.error("[create-club-staff] validation failed", {
        clubId: !!clubId,
        firstName: !!firstName,
        lastName: !!lastName,
        email: !!email,
      });
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
      await serviceClient.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          first_name: firstName,
          last_name: lastName,
          phone: phone || null,
        },
      });

    if (createError || !created?.user?.id) {
      console.error("[create-club-staff] create user failed", {
        email,
        error: createError?.message || null,
      });
      return new Response(
        JSON.stringify({
          error: createError?.message || "Could not create auth user",
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
      console.error("[create-club-staff] club_staff insert failed", {
        clubId,
        userId,
        error: staffError.message || null,
      });
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
      JSON.stringify({ ok: true, created: true, user_id: userId, email }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    console.error("[create-club-staff] unexpected error", {
      error: (e as any)?.message || String(e),
    });
    return new Response(
      JSON.stringify({ error: (e as any)?.message || String(e) }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
});
