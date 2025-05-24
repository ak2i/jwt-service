import { cors, Hono, jose, load } from "./deps.ts";

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

const app = new Hono();

// Hono v3: Middlewareの登録方法
app.use(cors());

// Hono v3: ルーティング
app.get("/health", (c) => {
  return c.json({ status: "ok" });
});

// Hono v3: Middlewareは app.use で登録し、ルートで next() を呼ぶ
const apiKeyAuth = async (c, next) => {
  if (!isProd) {
    console.log("apiKeyAuth has call.");
  }
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Missing or invalid Authorization header" }, 401);
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
    return c.json({ error: "Invalid API key" }, 401);
  }
  await next();
};

let privateKey;
let publicKey;

try {
  if (PRIVATE_KEY_PEM) {
    privateKey = await jose.importPKCS8(PRIVATE_KEY_PEM, "RS256");
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
    publicKey = await jose.importSPKI(PUBLIC_KEY_PEM, "RS256");
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
    publicKey = await jose.importJWK(privateJwk, "RS256");
  }
} catch (error) {
  console.error("Error initializing keys:", error);
  Deno.exit(1);
}

// app.post("/issue", apiKeyAuth, async (c) => {
app.on("POST", "/issue", apiKeyAuth, async (c) => {
  try {
    const { sub, entitlement_id, exp } = await c.req.json();

    if (!sub || !entitlement_id) {
      return c.json({ error: "Missing required fields: sub and entitlement_id are required" }, 400);
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

    return c.json({ token });
  } catch (error) {
    console.error("Error issuing token:", error);
    return c.json({ error: "Failed to issue token" }, 500);
  }
});

// app.post("/verify", async (c) => {
app.on("POST", "/verify", async (c) => {
  try {
    const { token } = await c.req.json();

    if (!token) {
      return c.json({ error: "Missing token" }, 400);
    }

    const { payload } = await jose.jwtVerify(token, publicKey, {
      algorithms: ["RS256"],
    });

    return c.json({
      valid: true,
      payload,
    });
  } catch (error) {
    console.error("Token verification failed:", error.message);
    return c.json({
      valid: false,
      error: error.message,
    }, 401);
  }
});

app.get("/.well-known/jwks.json", async (c) => {
  try {
    const jwk = await jose.exportJWK(publicKey);

    jwk.kid = KEY_ID;
    jwk.use = "sig";
    jwk.alg = "RS256";

    return c.json({
      keys: [jwk],
    });
  } catch (error) {
    console.error("Error generating JWKS:", error);
    return c.json({ error: "Failed to generate JWKS" }, 500);
  }
});

// Hono v3: サーバ起動
console.log(`JWT Service is running on http://localhost:${PORT}`);
Deno.serve({ port: PORT }, app.fetch);
