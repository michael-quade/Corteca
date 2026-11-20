/**
 * Server: a Corteca token for jobs with no signed-in user (the Fleet Metrics cron). Same
 * password grant as /api/auth/login, with CORTECA_SERVICE_USERNAME / CORTECA_SERVICE_PASSWORD
 * (falling back to the MCP header script's CORTECA_MCP_USERNAME / _PASSWORD). Never logs the
 * credentials or the token.
 */
export async function serviceToken(): Promise<string> {
  const base = process.env.CORTECA_API_BASE_URL;
  const clientId = process.env.CORTECA_CLIENT_ID;
  const clientSecret = process.env.CORTECA_CLIENT_SECRET;
  const user = process.env.CORTECA_SERVICE_USERNAME || process.env.CORTECA_MCP_USERNAME;
  const pass = process.env.CORTECA_SERVICE_PASSWORD || process.env.CORTECA_MCP_PASSWORD;
  if (!base || !clientId || !clientSecret) throw new Error("Corteca API not configured");
  if (!user || !pass) throw new Error("CORTECA_SERVICE_USERNAME / CORTECA_SERVICE_PASSWORD not set");

  const res = await fetch(`${base}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Service-Type": "KC", clientId, clientSecret },
    body: JSON.stringify({ email: user, grant_type: "password", password: pass }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Service login failed (${res.status})`);
  const { access_token } = (await res.json()) as { access_token?: string };
  if (!access_token) throw new Error("Service login returned no token");
  return access_token;
}
