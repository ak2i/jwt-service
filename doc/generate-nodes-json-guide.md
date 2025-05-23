# JWT Service ノード情報JSON生成ガイド

このドキュメントは、JWT Serviceのノード情報JSONを生成するCLIコマンドの拡張方法について説明します。AIが新しいデプロイ環境向けのコマンドを作成する際に参考にできるよう設計されています。

## 1. JSON構造の概要

JWT Serviceノード情報JSONは、以下の構造に従います：

```json
{
  "service": "jwt-service",
  "version": "1.0.0",
  "description": "JWT発行・検証サービス",
  "auth": {
    "type": "api_key",
    "header": "Authorization",
    "prefix": "Bearer",
    "key_acquisition": "APIキーの取得方法の説明"
  },
  "nodes": [
    {
      "id": "node-1",
      "host": "example.com",
      "port": 8000,
      "region": "ap-northeast-1",
      "status": "active",
      "endpoints": {
        "issue": "/issue",
        "verify": "/verify",
        "jwks": "/.well-known/jwks.json",
        "health": "/health"
      },
      "metadata": {
        "deployment_type": "ecs",
        "instance_type": "t3.small"
      }
    }
  ]
}
```

この構造は`doc/jwt-service-nodes.md`で詳細に定義されています。

## 2. 共通モジュールの構造

すべてのデプロイ環境向けコマンドは、共通の基盤モジュール`common.ts`を使用します。このモジュールは以下の主要コンポーネントを提供します：

### 2.1 インターフェース定義

```typescript
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
```

### 2.2 JSON生成関数

```typescript
export function generateNodesJson(config: JwtServiceNodesConfig): string {
  // デフォルト値とマージ
  // ノード情報の拡張
  // JSON文字列の生成
  return JSON.stringify(jsonObject, null, 2);
}
```

## 3. 新しいデプロイ環境向けコマンドの作成方法

新しいデプロイ環境（例：Kubernetes、Azure App Service等）向けのコマンドを作成するには、以下の手順に従ってください：

### 3.1 新しいコマンドファイルの作成

`cli/generate-nodes-json/`ディレクトリに新しいファイルを作成します（例：`kubernetes.ts`）：

```typescript
#!/usr/bin/env -S deno run --allow-env --allow-net

/**
 * Kubernetesデプロイ用のJWT Serviceノード情報JSON生成ツール
 * 使用方法: deno run --allow-env --allow-net cli/generate-nodes-json/kubernetes.ts --namespace default --replicas 3
 */

import { parse } from "https://deno.land/std@0.208.0/flags/mod.ts";
import { generateNodesJson, NodeConfig } from "./common.ts";

// コマンドライン引数の解析
const args = parse(Deno.args, {
  string: ["namespace", "host", "key-acquisition"],
  default: {
    namespace: "default",
    host: "jwt-service.example.com",
    replicas: 3,
    "key-acquisition": "APIキーはKubernetes Secretsから取得してください。",
  },
});

try {
  // 入力パラメータの処理
  const namespace = args.namespace;
  const host = args.host;
  const replicas = parseInt(args.replicas.toString());
  const keyAcquisition = args["key-acquisition"];

  // ノード設定の生成
  const nodes: NodeConfig[] = [];
  for (let i = 0; i < replicas; i++) {
    nodes.push({
      id: `node-${i + 1}`,
      host,
      port: 8000,
      status: "active",
      metadata: {
        deployment_type: "kubernetes",
        namespace,
        pod_name: `jwt-service-${i}`,
      },
    });
  }

  // JSON生成
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
```

### 3.2 メインコマンドの更新

`cli/generate-nodes-json.ts`のスイッチ文に新しいデプロイタイプを追加します：

```typescript
switch (deploymentType) {
  case "aws-ecs":
    scriptPath = "./generate-nodes-json/aws-ecs.ts";
    break;
  case "flyio":
    scriptPath = "./generate-nodes-json/flyio.ts";
    break;
  case "cloud-run":
    scriptPath = "./generate-nodes-json/cloud-run.ts";
    break;
  case "kubernetes": // 新しいデプロイタイプを追加
    scriptPath = "./generate-nodes-json/kubernetes.ts";
    break;
  default:
    throw new Error(`不明なデプロイタイプ: ${deploymentType}`);
}
```

### 3.3 ヘルプメッセージの更新

`printHelp()`関数内のヘルプメッセージに新しいデプロイタイプを追加します。

## 4. デプロイ環境固有の設定

各デプロイ環境には固有の設定があります。新しいデプロイ環境向けのコマンドを作成する際は、以下の点を考慮してください：

### 4.1 環境変数とシークレット管理

各デプロイ環境には、環境変数やシークレットの管理方法に違いがあります：

- AWS ECS: AWS Secrets Manager
- Fly.io: Fly Secrets
- Google Cloud Run: Secret Manager
- Kubernetes: Kubernetes Secrets

`key_acquisition`フィールドには、その環境でAPIキーを取得する方法を説明します。

### 4.2 ホスト名とポート

デプロイ環境によって、ホスト名の形式やデフォルトポートが異なります：

- AWS ECS: 内部ロードバランサーのDNS名、ポート8000
- Fly.io: グローバルホスト名（例：jwt-service.fly.dev）、ポート443
- Google Cloud Run: リージョン固有のホスト名、ポート443
- Kubernetes: サービス名またはIngress名、ポートは設定による

### 4.3 メタデータ

`metadata`フィールドには、デプロイ環境固有の情報を含めることができます：

```typescript
metadata: {
  deployment_type: "kubernetes",  // デプロイタイプ（必須）
  namespace: "default",           // 環境固有の設定
  pod_name: "jwt-service-0",      // 環境固有の設定
}
```

## 5. コマンドライン引数の設計パターン

新しいデプロイ環境向けのコマンドを作成する際は、以下のパターンに従ってコマンドライン引数を設計してください：

### 5.1 基本パターン

```typescript
const args = parse(Deno.args, {
  string: ["必須の文字列引数", "オプションの文字列引数"],
  boolean: ["フラグオプション"],
  default: {
    // デフォルト値
    "必須の文字列引数": "デフォルト値",
    "オプションの文字列引数": "デフォルト値",
    "フラグオプション": false,
  },
});
```

### 5.2 複数値の処理

カンマ区切りの値を配列に変換するパターン：

```typescript
const regions = args.region.split(",");
```

### 5.3 数値の処理

文字列から数値への変換：

```typescript
const count = parseInt(args.count.toString());
```

## 6. テスト方法

新しいデプロイ環境向けのコマンドを作成した後は、以下の方法でテストしてください：

```bash
# 直接実行
deno run --allow-env --allow-net cli/generate-nodes-json/新しいコマンド.ts

# メインコマンド経由で実行
deno run --allow-env --allow-read --allow-run cli/generate-nodes-json.ts 新しいデプロイタイプ
```

出力されたJSONが`doc/jwt-service-nodes.md`で定義されたスキーマに準拠していることを確認してください。

## 7. 実装例

既存の実装例を参考にしてください：

- AWS ECS: `cli/generate-nodes-json/aws-ecs.ts`
- Fly.io: `cli/generate-nodes-json/flyio.ts`
- Google Cloud Run: `cli/generate-nodes-json/cloud-run.ts`

これらの例は、異なるデプロイ環境向けのコマンドがどのように実装されているかを示しています。

## 8. まとめ

新しいデプロイ環境向けのコマンドを作成する際は：

1. 共通モジュール`common.ts`を使用する
2. デプロイ環境固有の設定を適切に処理する
3. コマンドライン引数を設計パターンに従って実装する
4. メインコマンド`generate-nodes-json.ts`を更新する
5. 出力されるJSONが正しいスキーマに準拠していることを確認する

これらの手順に従うことで、一貫性のある拡張可能なCLIコマンドを作成できます。
