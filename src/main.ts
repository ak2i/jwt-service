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
const HOSTNAME = Deno.env.get("HOSTNAME") || "::";
if (!isProd) {
  console.log(`HOSTNAME:${HOSTNAME}`);
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

// New: verify-only mode and binding/replay enforcement flags
const VERIFY_ONLY = (Deno.env.get("VERIFY_ONLY") || "false").toLowerCase() === "true";
const ENFORCE_BINDING = (Deno.env.get("ENFORCE_BINDING") || "false").toLowerCase() === "true";
const REPLAY_CACHE_ENABLED = (Deno.env.get("REPLAY_CACHE_ENABLED") || "false").toLowerCase() === "true";
const REPLAY_TTL_SEC = Number(Deno.env.get("REPLAY_TTL_SEC") || 120);
const REQUIRE_JTI_ON_VERIFY = ENFORCE_BINDING || (Deno.env.get("REQUIRE_JTI_ON_VERIFY") || "false").toLowerCase() === "true";
const ISSUER = Deno.env.get("ISS") || undefined; // optional issuer to set when issuing
const AUDIENCE = Deno.env.get("AUD") || undefined; // optional audience to set/verify

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

let privateKey: CryptoKey | undefined;
let publicKey: CryptoKey | undefined;

try {
  if (!VERIFY_ONLY) {
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
  }

  if (PUBLIC_KEY_PEM) {
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
    delete (privateJwk as any).d; // Remove private component
    delete (privateJwk as any).dp;
    delete (privateJwk as any).dq;
    delete (privateJwk as any).p;
    delete (privateJwk as any).q;
    delete (privateJwk as any).qi;
    publicKey = await jose.importJWK(privateJwk, "RS256", true);
  }
} catch (error) {
  console.error("Error initializing keys:", error);
  Deno.exit(1);
}

// Simple in-memory replay cache
const replayCache: Map<string, number> = new Map();
if (REPLAY_CACHE_ENABLED) {
  // periodic cleanup
  setInterval(() => {
    const now = Math.floor(Date.now() / 1000);
    for (const [jti, expAt] of replayCache.entries()) {
      if (expAt <= now) replayCache.delete(jti);
    }
  }, Math.min(Math.max(REPLAY_TTL_SEC, 10), 600) * 500); // cleanup every ~TTL/2, clamped
}

// Helper to compute sha256 hex for request bodies (Node-like portability not needed)
async function sha256Hex(input: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", input);
  const bytes = new Uint8Array(digest);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Conditionally register /issue route (disabled in VERIFY_ONLY)
if (!VERIFY_ONLY) {
  // app.post("/issue", apiKeyAuth, async (c) => {
  app.on("POST", "/issue", apiKeyAuth, async (c) => {
    try {
      const body = await c.req.json();
      const { sub, exp, nbf, jti, method, url, body_sha256, iss, aud, ...restClaims } = body || {};

      if (!sub) {
        return c.json({ error: "Missing required field: sub" }, 400);
      }

    // Exclude reserved claims that will be set via builder methods
      delete (restClaims as any).iat;
      delete (restClaims as any).exp;
      delete (restClaims as any).nbf;
      delete (restClaims as any).jti;

      let expiration = exp;
      if (!expiration) {
        if (/^\d+$/.test(DEFAULT_EXPIRATION)) {
          expiration = Math.floor(Date.now() / 1000) + parseInt(DEFAULT_EXPIRATION);
        } else {
          expiration = DEFAULT_EXPIRATION;
        }
      }

      const claims: Record<string, unknown> = { sub, ...restClaims };
      // Optional request-binding claims
      if (method) claims.method = method;
      if (url) claims.url = url;
      if (body_sha256) claims.body_sha256 = body_sha256;
      if ((ISSUER || iss)) claims.iss = iss || ISSUER;
      if ((AUDIENCE || aud)) claims.aud = aud || AUDIENCE;
      if (jti) claims.jti = jti; else claims.jti = crypto.randomUUID();

      let signer = new jose.SignJWT(claims)
        .setProtectedHeader({ alg: "RS256", kid: KEY_ID })
        .setIssuedAt()
        .setExpirationTime(expiration);

      if (nbf) {
        signer = signer.setNotBefore(nbf);
      }

      const token = await signer.sign(privateKey!);

      return c.json({ token });
    } catch (error) {
      console.error("Error issuing token:", error);
      return c.json({ error: "Failed to issue token" }, 500);
    }
  });
} else {
  console.log("VERIFY_ONLY mode enabled: /issue endpoint is disabled and private key ignored");
}

// app.post("/verify", async (c) => {
app.on("POST", "/verify", async (c) => {
  try {
    const { token, context } = await c.req.json();

    if (!token) {
      return c.json({ error: "Missing token" }, 400);
    }

    const { payload } = await jose.jwtVerify(token, publicKey!, {
      algorithms: ["RS256"],
      issuer: ISSUER || undefined,
      audience: AUDIENCE || undefined,
    });

    // Optional request binding enforcement
    if (ENFORCE_BINDING) {
      const boundMethod = payload["method"];
      const boundUrl = payload["url"];
      const boundBodyHash = payload["body_sha256"];
      const given = context || {};

      if (boundMethod && given.method && boundMethod !== given.method) {
        return c.json({ valid: false, error: "method mismatch" }, 401);
      }
      if (boundUrl && given.url && boundUrl !== given.url) {
        return c.json({ valid: false, error: "url mismatch" }, 401);
      }
      if (boundBodyHash) {
        if (given.body_sha256) {
          if (boundBodyHash !== given.body_sha256) {
            return c.json({ valid: false, error: "body_sha256 mismatch" }, 401);
          }
        } else if (given.body_raw) {
          const encoder = new TextEncoder();
          const computed = await sha256Hex(encoder.encode(given.body_raw));
          if (computed !== boundBodyHash) {
            return c.json({ valid: false, error: "body_sha256 mismatch" }, 401);
          }
        } else {
          return c.json({ valid: false, error: "missing body for hash verification" }, 401);
        }
      }
    }

    // Replay protection based on jti within TTL/exp window
    if (REPLAY_CACHE_ENABLED) {
      const now = Math.floor(Date.now() / 1000);
      const jti = (payload["jti"] as string | undefined);
      if (!jti) {
        if (REQUIRE_JTI_ON_VERIFY) {
          return c.json({ valid: false, error: "missing jti" }, 401);
        }
      } else {
        const exp = (payload["exp"] as number | undefined) || now + REPLAY_TTL_SEC;
        // expiry for cache is min(exp, now+REPLAY_TTL_SEC)
        const until = Math.min(exp, now + REPLAY_TTL_SEC);
        if (replayCache.has(jti)) {
          return c.json({ valid: false, error: "replay detected" }, 401);
        }
        replayCache.set(jti, until);
      }
    }

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
console.log(`JWT Service is running on http://${HOSTNAME}:${PORT}`);
Deno.serve({ hostname: HOSTNAME, port: PORT }, app.fetch);
