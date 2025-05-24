import fs from 'fs';
import path from 'path';
import axios from 'axios';

async function main() {
  const [,, jsonPath, apiKeyPath] = process.argv;
  if (!jsonPath || !apiKeyPath) {
    console.error('Usage: ts-node test_nodes_from_json.ts <nodes.json> <api-key.txt>');
    process.exit(1);
  }

  const nodesJson = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  const apiKey = fs.readFileSync(apiKeyPath, 'utf-8').toString().trim();

  for (const node of nodesJson.nodes) {
    const baseUrl = `https://${node.host}:${node.port}`;
    const headers = {
      [nodesJson.auth.header]: `${nodesJson.auth.prefix} ${apiKey}`,
      'Content-Type': 'application/json'
    };
    console.log(`\n=== Testing node: ${node.id} (${baseUrl}) ===`);

    // /health
    try {
      const res = await axios.get(baseUrl + node.endpoints.health);
      console.log(`[health] status: ${res.status}, body:`, res.data);
    } catch (e: any) {
      console.error(`[health] error:`, e.message);
    }

    // /jwks
    try {
      const res = await axios.get(baseUrl + node.endpoints.jwks);
      console.log(`[jwks] status: ${res.status}, keys:`, res.data.keys?.length ?? 'N/A');
    } catch (e: any) {
      console.error(`[jwks] error:`, e.message);
    }

    // /issue
    let token = '';
    try {
      const payload = { sub: "test-user", aud: "test-client" };
      const res = await axios.post(baseUrl + node.endpoints.issue, payload, { headers });
      token = res.data.token;
      console.log(`[issue] status: ${res.status}, token:`, token ? token.slice(0, 20) + '...' : 'N/A');
    } catch (e: any) {
      console.error(`[issue] error:`, e.message);
    }

    // /verify
    if (token) {
      try {
        const res = await axios.post(baseUrl + node.endpoints.verify, { token }, { headers });
        console.log(`[verify] status: ${res.status}, body:`, res.data);
      } catch (e: any) {
        console.error(`[verify] error:`, e.message);
      }
    }
  }
}

main();
