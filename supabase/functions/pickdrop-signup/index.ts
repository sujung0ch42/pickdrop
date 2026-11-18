const origin = "https://pickdrop-sujung0ch42.vercel.app";
const headers = {
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};
const respond = (status: number, body: object) =>
  new Response(JSON.stringify(body), { status, headers });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return respond(405, { error: "method" });

  try {
    const source = await request.text();
    if (source.length > 2048) return respond(400, { error: "invalid_input" });
    const { username, password } = JSON.parse(source);
    if (
      typeof username !== "string" ||
      !/^[a-z0-9_]{3,24}$/.test(username) ||
      typeof password !== "string" ||
      password.length < 8 ||
      new TextEncoder().encode(password).length > 72
    )
      return respond(400, { error: "invalid_input" });

    const base = Deno.env.get("SUPABASE_URL");
    const adminKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!base || !adminKey) return respond(503, { error: "unavailable" });
    const admin = {
      apikey: adminKey,
      Authorization: "Bearer " + adminKey,
      "Content-Type": "application/json",
    };
    // The gateway's x-real-ip is used rather than the request's user-supplied Origin.
    const ip = request.headers.get("x-real-ip") || "unknown";
    const limit = await fetch(base + "/rest/v1/rpc/pickdrop_limit_signup", {
      method: "POST",
      headers: admin,
      body: JSON.stringify({ caller: ip }),
    });
    if (!limit.ok) return respond(503, { error: "unavailable" });
    if (!(await limit.json())) return respond(429, { error: "rate_limited" });

    const created = await fetch(base + "/auth/v1/admin/users", {
      method: "POST",
      headers: admin,
      body: JSON.stringify({
        email: username + "@users.pickdrop.invalid",
        password,
        email_confirm: true,
      }),
    });
    if (!created.ok) {
      const problem = await created.json();
      const code = problem.error_code ?? problem.code;
      if (code === "email_exists" || code === "user_already_exists") {
        return respond(409, { error: "username_taken" });
      }
      if (code === "weak_password")
        return respond(400, { error: "weak_password" });
      return respond(503, { error: "unavailable" });
    }
    return respond(201, { created: true });
  } catch {
    return respond(400, { error: "invalid_input" });
  }
});
