#!/usr/bin/env -S deno run --allow-env --allow-net

/**
 * AWS ECSデプロイ用のJWT Serviceノード情報JSON生成ツール
 * 使用方法: deno run --allow-env --allow-net cli/generate-nodes-json/aws-ecs.ts --region ap-northeast-1,us-west-2 --host-prefix jwt-service-ecs --count 2
 */

import { parse } from "https://deno.land/std@0.208.0/flags/mod.ts";
import { generateNodesJson, NodeConfig } from "./common.ts";

const args = parse(Deno.args, {
  string: ["region", "host-prefix", "key-acquisition"],
  default: {
    region: "ap-northeast-1",
    "host-prefix": "jwt-service",
    "key-acquisition": "APIキーはAWS Secrets Managerから取得してください。詳細は管理者にお問い合わせください。",
    count: 1,
  },
});

try {
  const regions = args.region.split(",");
  const hostPrefix = args["host-prefix"];
  const count = parseInt(args.count.toString());
  const keyAcquisition = args["key-acquisition"];

  const nodes: NodeConfig[] = [];
  for (let i = 0; i < count; i++) {
    const regionIndex = i % regions.length;
    nodes.push({
      id: `node-${i + 1}`,
      host: `${hostPrefix}-${i + 1}.example.com`,
      port: 8000,
      region: regions[regionIndex],
      status: "active",
      metadata: {
        deployment_type: "ecs",
        instance_type: "t3.small",
      },
    });
  }

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
