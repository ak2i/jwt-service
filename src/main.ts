

import { Hono, cors, jwt, jose } from "./deps.ts";

const app = new Hono();

app.use("*", cors());

app.get("/health", (c) => {
  return c.json({ status: "ok" });
});

const JWT_SECRET = Deno.env.get("JWT_SECRET") || "your-secret-key";

const auth = app.use(
  "/api/*",
  jwt({
    secret: JWT_SECRET,
  })
);

auth.get("/api/protected", (c) => {
  const payload = c.get("jwtPayload");
  return c.json({
    message: "This is a protected endpoint",
    user: payload,
  });
});

app.post("/login", async (c) => {
  const { username, password } = await c.req.json();
  
  if (username === "test" && password === "password") {
    const payload = {
      id: "1",
      username: username,
      role: "user",
    };
    
    const token = await new jose.SignJWT(payload)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("2h")
      .sign(new TextEncoder().encode(JWT_SECRET));
    
    return c.json({ token });
  }
  
  return c.json({ error: "Invalid credentials" }, 401);
});

const port = parseInt(Deno.env.get("PORT") || "8000");
console.log(`Server is running on http://localhost:${port}`);

Deno.serve({ port }, app.fetch);
