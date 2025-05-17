#!/usr/bin/env -S deno run --allow-env

/**
 * 共通のJWT Serviceノード情報JSON生成ロジック
 */

export interface NodeConfig {
  id: string;
  host: string;
  port?: number;
  region?: string;
  status?: "active" | "inactive" | "maintenance";
  metadata?: Record<string, unknown>;
}

export interface JwtServiceNodesConfig {
  service?: string;
  version?: string;
  description?: string;
  auth?: {
    type: "api_key" | "oauth2" | "none";
    header: string;
    prefix?: string;
    key_acquisition?: string;
  };
  nodes: NodeConfig[];
}

export function generateNodesJson(config: JwtServiceNodesConfig): string {
  const defaultConfig: JwtServiceNodesConfig = {
    service: "jwt-service",
    version: "1.0.0",
    description: "JWT発行・検証サービス",
    auth: {
      type: "api_key",
      header: "Authorization",
      prefix: "Bearer",
    },
    nodes: [],
  };

  const mergedConfig = {
    ...defaultConfig,
    ...config,
    auth: {
      ...defaultConfig.auth,
      ...config.auth,
    },
  };

  const nodesWithEndpoints = mergedConfig.nodes.map(node => ({
    ...node,
    port: node.port || 8000,
    status: node.status || "active",
    endpoints: {
      issue: "/issue",
      verify: "/verify",
      jwks: "/.well-known/jwks.json",
      health: "/health",
    },
  }));

  const jsonObject = {
    ...mergedConfig,
    nodes: nodesWithEndpoints,
  };

  return JSON.stringify(jsonObject, null, 2);
}
