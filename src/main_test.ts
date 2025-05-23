import { assert, assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";

const API_KEY = "test-api-key";
const PORT = 4567;
const BASE_URL = `http://localhost:${PORT}`;

function startServer() {
  return new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--allow-net",
      "--allow-env",
      "src/main.ts",
    ],
    env: { PORT: PORT.toString(), API_KEY },
    stdout: "piped",
    stderr: "piped",
  }).spawn();
}

async function waitForServer(url: string, timeout = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(url);
      if (res.body) {
        await res.body.cancel();
      }
      if (res.ok) return;
    } catch (_) {
      // ignore until server is ready
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("Server did not start in time");
}

Deno.test("JWT service endpoints", async (t) => {
  const server = startServer();
  try {
    await waitForServer(`${BASE_URL}/health`);

    await t.step("/health", async () => {
      const res = await fetch(`${BASE_URL}/health`);
      const data = await res.json();
      assertEquals(res.status, 200);
      assertEquals(data.status, "ok");
    });

    let token = "";
    await t.step("/issue", async () => {
      const res = await fetch(`${BASE_URL}/issue`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({ sub: "user123", entitlement_id: "entitlement456" }),
      });
      const data = await res.json();
      assertEquals(res.status, 200);
      assert(data.token);
      token = data.token;
    });

    await t.step("/verify", async () => {
      const res = await fetch(`${BASE_URL}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      assertEquals(res.status, 200);
      assert(data.valid);
      assertEquals(data.payload.sub, "user123");
      assertEquals(data.payload.entitlement_id, "entitlement456");
    });
  } finally {
    server.kill("SIGTERM");
    await server.status;
    if (server.stdout) {
      await server.stdout.cancel();
    }
    if (server.stderr) {
      await server.stderr.cancel();
    }
  }
});
