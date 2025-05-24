#!/usr/bin/env -S deno run --allow-net --allow-read

// Test connectivity against a list of JWT service nodes described in a JSON
// file. The script expects two arguments:
//   deno run --allow-net --allow-read cli/test_nodes_from_json.ts <nodes.json> <api-key.txt>

async function main() {
  const [jsonPath, apiKeyPath] = Deno.args;
  if (!jsonPath || !apiKeyPath) {
    console.error(
      'Usage: deno run --allow-net --allow-read cli/test_nodes_from_json.ts <nodes.json> <api-key.txt>',
    );
    Deno.exit(1);
  }

  const nodesJson = JSON.parse(await Deno.readTextFile(jsonPath));
  const apiKey = (await Deno.readTextFile(apiKeyPath)).trim();

  for (const node of nodesJson.nodes) {
    const baseUrl = `https://${node.host}:${node.port}`;
    const headers = {
      [nodesJson.auth.header]: `${nodesJson.auth.prefix} ${apiKey}`,
      "Content-Type": "application/json",
    };
    console.log(`\n=== Testing node: ${node.id} (${baseUrl}) ===`);

    // /health
    try {
      const res = await fetch(baseUrl + node.endpoints.health);
      const data = await res.json();
      console.log(`[health] status: ${res.status}, body:`, data);
    } catch (e: any) {
      console.error(`[health] error:`, e.message);
    }

    // /jwks
    try {
      const res = await fetch(baseUrl + node.endpoints.jwks);
      const data = await res.json();
      console.log(`[jwks] status: ${res.status}, keys:`, data.keys?.length ?? "N/A");
    } catch (e: any) {
      console.error(`[jwks] error:`, e.message);
    }

    // /issue
    let token = "";
    try {
      const payload = { sub: "test-user", aud: "test-client" };
      const res = await fetch(baseUrl + node.endpoints.issue, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      token = data.token;
      console.log(
        `[issue] status: ${res.status}, token:`,
        token ? token.slice(0, 20) + "..." : "N/A",
      );
    } catch (e: any) {
      console.error(`[issue] error:`, e.message);
    }

    // /verify
    if (token) {
      try {
        const res = await fetch(baseUrl + node.endpoints.verify, {
          method: "POST",
          headers,
          body: JSON.stringify({ token }),
        });
        const data = await res.json();
        console.log(`[verify] status: ${res.status}, body:`, data);
      } catch (e: any) {
        console.error(`[verify] error:`, e.message);
      }
    }
  }
}

main();
