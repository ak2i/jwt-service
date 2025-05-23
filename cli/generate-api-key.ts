#!/usr/bin/env -S deno run --allow-env --allow-hrtime

/**
 * CLI tool to generate a secure random API key for jwt-service
 * Run with: deno run --allow-env --allow-hrtime cli/generate-api-key.ts
 */

const KEY_LENGTH = parseInt(Deno.env.get("KEY_LENGTH") || "48");

function generateSecureApiKey(length: number): string {
  const buffer = new Uint8Array(length);
  crypto.getRandomValues(buffer);

  return btoa(String.fromCharCode(...buffer))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "")
    .substring(0, length);
}

try {
  const apiKey = generateSecureApiKey(KEY_LENGTH);
  console.log(apiKey);
} catch (error) {
  console.error("Error generating API key:", error.message);
  Deno.exit(1);
}
