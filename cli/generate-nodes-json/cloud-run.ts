#!/usr/bin/env -S deno run --allow-env --allow-net

/**
 * Google Cloud Runデプロイ用のJWT Serviceノード情報JSON生成ツール
 * 使用方法: deno run --allow-env --allow-net cli/generate-nodes-json/cloud-run.ts --region us-central1,asia-northeast1 --host-template jwt-service-REGION.run.app
 */

import { parse } from "https://deno.land/std@0.208.0/flags/mod.ts";
import { generateNodesJson, NodeConfig } from "./common.ts";

const args = parse(Deno.args, {
  string: ["region", "host-template", "key-acquisition"],
  default: {
    region: "us-central1,asia-northeast1",
    "host-template": "jwt-service-REGION.run.app",
    "key-acquisition": "APIキーはGoogle Secret Managerから取得してください。詳細は管理者にお問い合わせください。",
  },
});

try {
  const regions = args.region.split(",");
  const hostTemplate = args["host-template"];
  const keyAcquisition = args["key-acquisition"];

  const nodes: NodeConfig[] = regions.map((region, index) => {
    const host = hostTemplate.replace("REGION", region);
    return {
      id: `node-${index + 1}`,
      host,
      port: 443,
      region,
      status: "active",
      metadata: {
        deployment_type: "cloud-run",
        min_instances: 1,
      },
    };
  });

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
