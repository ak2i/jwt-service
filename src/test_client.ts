const BASE_URL = "http://localhost:8801";
const API_KEY = Deno.env.get("API_KEY") || "dev-api-key";

async function issueToken(sub: string, entitlement_id: string, exp?: number): Promise<string> {
  const payload: Record<string, unknown> = {
    sub,
    entitlement_id,
  };

  if (exp) {
    payload.exp = exp;
  }
  console.log(`API_KEY:${API_KEY}`)
  const response = await fetch(`${BASE_URL}/issue`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Failed to issue token: ${data.error}`);
  }

  return data.token;
}

async function verifyToken(token: string): Promise<Record<string, unknown>> {
  const response = await fetch(`${BASE_URL}/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Failed to verify token: ${data.error}`);
  }

  return data;
}

async function getJwks(): Promise<Record<string, unknown>> {
  const response = await fetch(`${BASE_URL}/.well-known/jwks.json`);

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Failed to get JWKS: ${data.error}`);
  }

  return data;
}

async function main() {
  try {
    console.log("Testing JWT service...");

    const healthResponse = await fetch(`${BASE_URL}/health`);
    const healthData = await healthResponse.json();
    console.log("Health check:", healthData);

    console.log("Getting JWKS...");
    const jwks = await getJwks();
    console.log("JWKS response:", jwks);

    console.log("Issuing a token...");
    const token = await issueToken("user123", "entitlement456");
    console.log("Received token:", token.substring(0, 20) + "...");

    console.log("Verifying token...");
    const verifyResult = await verifyToken(token);
    console.log("Verification result:", verifyResult);

    console.log("Issuing a token with custom expiration...");
    const expTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
    const tokenWithExp = await issueToken("user789", "entitlement101", expTime);
    console.log("Received token with custom exp:", tokenWithExp.substring(0, 20) + "...");

    console.log("Verifying token with custom expiration...");
    const verifyResultWithExp = await verifyToken(tokenWithExp);
    console.log("Verification result for custom exp token:", verifyResultWithExp);

    console.log("All tests passed successfully!");
  } catch (error) {
    console.error("Test failed:", error.message);
  }
}

if (import.meta.url === Deno.mainModule) {
  main();
}
