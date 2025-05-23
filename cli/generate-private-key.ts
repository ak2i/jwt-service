#!/usr/bin/env -S deno run --allow-env --allow-hrtime

/**
 * CLI tool to generate an RSA private key and matching public key.
 * Run with: deno run --allow-env --allow-hrtime cli/generate-private-key.ts
 * Set MODULUS_LENGTH environment variable to change key size (default 2048).
 */

import * as jose from "https://deno.land/x/jose@v4.14.4/index.ts";

const MODULUS_LENGTH = parseInt(Deno.env.get("MODULUS_LENGTH") || "2048");

async function generateKeyPair(modulusLength: number): Promise<{
  privateKey: string;
  publicKey: string;
}> {
  const { privateKey, publicKey } = await jose.generateKeyPair("RS256", {
    modulusLength,
  });
  const privatePem = await jose.exportPKCS8(privateKey);
  const publicPem = await jose.exportSPKI(publicKey);
  return { privateKey: privatePem, publicKey: publicPem };
}

try {
  const { privateKey, publicKey } = await generateKeyPair(MODULUS_LENGTH);
  console.log(JSON.stringify({ privateKey, publicKey }, null, 2));
} catch (error) {
  console.error("Error generating key pair:", error.message);
  Deno.exit(1);
}
