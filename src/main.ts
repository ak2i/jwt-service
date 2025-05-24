import { dinatra, jose, load } from "./deps.ts";

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

const isProd = Deno.env.get("DENO_ENV") === "production";

if (!isProd) {
  try {
    await load({ export: true });
    console.log("Loaded environment variables from .env file");
  } catch (error) {
    console.warn("No .env file found or error loading it:", error.message);
  }
}

// Parse and validate the PORT environment variable to avoid NaN values
const rawPort = Deno.env.get("PORT");
const parsedPort = rawPort ? Number(rawPort) : NaN;
const PORT = Number.isInteger(parsedPort) && parsedPort > 0 && parsedPort < 65536
  ? parsedPort
  : 8000;
if (rawPort && PORT !== parsedPort) {
  console.warn(`Invalid PORT value '${rawPort}', falling back to ${PORT}`);
}
const API_KEY = Deno.env.get("API_KEY") || "dev-api-key";
if (!isProd) {
  console.log(`API_KEY:${API_KEY}`);
}
const API_KEY_CURRENT = Deno.env.get("API_KEY_CURRENT") || API_KEY; // Use API_KEY as fallback
if (!isProd) {
  console.log(`API_KEY_CURRENT:${API_KEY_CURRENT}`);
}
const API_KEY_PREVIOUS_PLACEHOLDER = "NONE";
const rawApiKeyPrevious = Deno.env.get("API_KEY_PREVIOUS");
const API_KEY_PREVIOUS = rawApiKeyPrevious && rawApiKeyPrevious !== API_KEY_PREVIOUS_PLACEHOLDER
  ? rawApiKeyPrevious
  : "";
if (!isProd) {
  console.log(`API_KEY_PREVIOUS:${API_KEY_PREVIOUS}`);
}
const PRIVATE_KEY_PEM = Deno.env.get("PRIVATE_KEY_PEM");
const PUBLIC_KEY_PEM = Deno.env.get("PUBLIC_KEY_PEM");
const KEY_ID = Deno.env.get("KEY_ID") || "default-key-1";
const DEFAULT_EXPIRATION = Deno.env.get("DEFAULT_EXPIRATION") || "1h";

const app = dinatra();

// Basic CORS support
app.options("/*", () =>
  new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    },
  }));

// Simple health check endpoint
app.get("/health", () => jsonResponse({ status: "ok" }));

const apiKeyAuth = (req: Request): Response | undefined => {
  if (!isProd) {
    console.log("apiKeyAuth has call.");
  }
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return jsonResponse({ error: "Missing or invalid Authorization header" }, 401);
  }
  const providedKey = authHeader.substring(7);
  if (!isProd) {
    console.log("Authorization header:", authHeader);
    console.log("providedKey:", providedKey);
    console.log("API_KEY_CURRENT:", API_KEY_CURRENT);
    console.log("API_KEY_PREVIOUS:", API_KEY_PREVIOUS);
  }
  const VALID_KEYS = [API_KEY_CURRENT, API_KEY_PREVIOUS].filter(Boolean);
  if (!VALID_KEYS.includes(providedKey)) {
    return jsonResponse({ error: "Invalid API key" }, 401);
  }
  return undefined;
};

let privateKey;
let publicKey;

try {
  if (PRIVATE_KEY_PEM) {
    privateKey = await jose.importPKCS8(
      PRIVATE_KEY_PEM,
      "RS256",
      { extractable: true },
    );
    console.log("Loaded private key from environment variable");
  } else {
    console.warn("No private key provided, generating a temporary key pair for development");
    const keyPair = await jose.generateKeyPair("RS256");
    privateKey = keyPair.privateKey;
    publicKey = keyPair.publicKey;

    const exportedPublicKey = await jose.exportSPKI(publicKey);
    console.log(
      "Generated temporary public key for development:",
      exportedPublicKey.substring(0, 64) + "...",
    );
  }

  if (PUBLIC_KEY_PEM && !publicKey) {
    publicKey = await jose.importSPKI(
      PUBLIC_KEY_PEM,
      "RS256",
      { extractable: true },
    );
    console.log("Loaded public key from environment variable");
  }

  if (!publicKey && privateKey) {
    console.log("Extracting public key from private key");
    const privateJwk = await jose.exportJWK(privateKey);
    delete privateJwk.d; // Remove private component
    delete privateJwk.dp;
    delete privateJwk.dq;
    delete privateJwk.p;
    delete privateJwk.q;
    delete privateJwk.qi;
    publicKey = await jose.importJWK(privateJwk, "RS256", true);
  }
} catch (error) {
  console.error("Error initializing keys:", error);
  Deno.exit(1);
}

app.post("/issue", async (req) => {
  const authCheck = await apiKeyAuth(req);
  if (authCheck) return authCheck;
  try {
    const { sub, entitlement_id, exp } = await req.json();

    if (!sub || !entitlement_id) {
      return jsonResponse({
        error: "Missing required fields: sub and entitlement_id are required",
      }, 400);
    }

    const payload = {
      sub,
      entitlement_id,
      iat: Math.floor(Date.now() / 1000),
    };

    let expiration = exp;
    if (!expiration) {
      if (/^\d+$/.test(DEFAULT_EXPIRATION)) {
        expiration = Math.floor(Date.now() / 1000) + parseInt(DEFAULT_EXPIRATION);
      } else {
        expiration = DEFAULT_EXPIRATION;
      }
    }

    const token = await new jose.SignJWT(payload)
      .setProtectedHeader({ alg: "RS256", kid: KEY_ID })
      .setIssuedAt()
      .setExpirationTime(expiration)
      .sign(privateKey);

    return jsonResponse({ token });
  } catch (error) {
    console.error("Error issuing token:", error);
    return jsonResponse({ error: "Failed to issue token" }, 500);
  }
});

app.post("/verify", async (req) => {
  try {
    const { token } = await req.json();

    if (!token) {
      return jsonResponse({ error: "Missing token" }, 400);
    }

    const { payload } = await jose.jwtVerify(token, publicKey, {
      algorithms: ["RS256"],
    });

    return jsonResponse({
      valid: true,
      payload,
    });
  } catch (error) {
    console.error("Token verification failed:", error.message);
    return jsonResponse({
      valid: false,
      error: error.message,
    }, 401);
  }
});

app.get("/.well-known/jwks.json", async () => {
  try {
    const jwk = await jose.exportJWK(publicKey);

    jwk.kid = KEY_ID;
    jwk.use = "sig";
    jwk.alg = "RS256";

    return jsonResponse({
      keys: [jwk],
    });
  } catch (error) {
    console.error("Error generating JWKS:", error);
    return jsonResponse({ error: "Failed to generate JWKS" }, 500);
  }
});

// Server start
console.log(`JWT Service is running on http://localhost:${PORT}`);
await app.listen({ port: PORT });
