#!/usr/bin/env -S deno run --allow-env --allow-net

/**
 * Fly.ioデプロイ用のJWT Serviceノード情報JSON生成ツール
 * 使用方法: deno run --allow-env --allow-net cli/generate-nodes-json/flyio.ts --region nrt,fra,syd --host jwt-service.fly.dev
 */

import { parse } from "https://deno.land/std@0.208.0/flags/mod.ts";
import { generateNodesJson, NodeConfig } from "./common.ts";

const args = parse(Deno.args, {
  string: ["region", "host", "key-acquisition"],
  default: {
    region: "nrt,fra,syd",
    host: "jwt-service.fly.dev",
    "key-acquisition": "APIキーはFly Secretsから取得してください。詳細は管理者にお問い合わせください。",
  },
});

try {
  const regions = args.region.split(",");
  const host = args.host;
  const keyAcquisition = args["key-acquisition"];

  const nodes: NodeConfig[] = regions.map((region, index) => ({
    id: `node-${index + 1}`,
    host,
    port: 443,
    region,
    status: "active",
    metadata: {
      deployment_type: "fly.io",
      region_code: region,
    },
  }));

  const json = generateNodesJson({
    auth: {
      type: "api_key",
      header: "Authorization",
      prefix: "Bearer",
      key_acquisition: keyAcquisition,
    },
    nodes,
  });

  console.log(json);
} catch (error) {
  console.error("Error generating nodes JSON:", error.message);
  Deno.exit(1);
}
