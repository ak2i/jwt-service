# JWT Service ノード情報 JSON 設計

このドキュメントでは、分散配置されたJWT Serviceの全ノード情報を表現するためのJSON形式を定義します。このJSONは、外部サービスがJWT Serviceを利用するために必要な情報を提供します。

## 目的

- 分散配置されたJWT Serviceの全ノード情報を一元管理する
- 外部サービスがJWT Serviceを利用するために必要な情報を提供する
- ノードの追加・削除・更新を容易にする

## JSON スキーマ

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["service", "version", "nodes"],
  "properties": {
    "service": {
      "type": "string",
      "description": "サービス名",
      "example": "jwt-service"
    },
    "version": {
      "type": "string",
      "description": "JSONスキーマのバージョン",
      "example": "1.0.0"
    },
    "description": {
      "type": "string",
      "description": "サービスの説明",
      "example": "JWT発行・検証サービス"
    },
    "auth": {
      "type": "object",
      "description": "認証情報",
      "required": ["type", "header"],
      "properties": {
        "type": {
          "type": "string",
          "description": "認証タイプ",
          "enum": ["api_key", "oauth2", "none"],
          "example": "api_key"
        },
        "header": {
          "type": "string",
          "description": "認証ヘッダー名",
          "example": "Authorization"
        },
        "prefix": {
          "type": "string",
          "description": "認証ヘッダーの接頭辞",
          "example": "Bearer"
        },
        "key_acquisition": {
          "type": "string",
          "description": "APIキーの取得方法の説明",
          "example": "APIキーはAWS Secrets Managerから取得してください。詳細は管理者にお問い合わせください。"
        }
      }
    },
    "nodes": {
      "type": "array",
      "description": "JWT Serviceノードのリスト",
      "items": {
        "type": "object",
        "required": ["id", "host", "status", "endpoints"],
        "properties": {
          "id": {
            "type": "string",
            "description": "ノードの一意識別子",
            "example": "node-1"
          },
          "host": {
            "type": "string",
            "description": "ノードのホスト名またはIPアドレス",
            "example": "jwt-service-1.example.com"
          },
          "port": {
            "type": "integer",
            "description": "ノードのポート番号",
            "example": 8000
          },
          "region": {
            "type": "string",
            "description": "ノードのリージョン",
            "example": "ap-northeast-1"
          },
          "status": {
            "type": "string",
            "description": "ノードのステータス",
            "enum": ["active", "inactive", "maintenance"],
            "example": "active"
          },
          "endpoints": {
            "type": "object",
            "description": "利用可能なエンドポイント",
            "required": ["issue", "verify", "jwks", "health"],
            "properties": {
              "issue": {
                "type": "string",
                "description": "JWT発行エンドポイント",
                "example": "/issue"
              },
              "verify": {
                "type": "string",
                "description": "JWT検証エンドポイント",
                "example": "/verify"
              },
              "jwks": {
                "type": "string",
                "description": "JWKS公開鍵エンドポイント",
                "example": "/.well-known/jwks.json"
              },
              "health": {
                "type": "string",
                "description": "ヘルスチェックエンドポイント",
                "example": "/health"
              }
            }
          },
          "metadata": {
            "type": "object",
            "description": "追加のメタデータ",
            "additionalProperties": true
          }
        }
      }
    }
  }
}
```

## 使用例

以下は、実際のJWT Serviceノード情報を表現するJSONの例です：

```json
{
  "service": "jwt-service",
  "version": "1.0.0",
  "description": "JWT発行・検証サービス",
  "auth": {
    "type": "api_key",
    "header": "Authorization",
    "prefix": "Bearer",
    "key_acquisition": "APIキーはAWS Secrets Managerから取得してください。詳細は管理者にお問い合わせください。"
  },
  "nodes": [
    {
      "id": "node-1",
      "host": "jwt-service-1.example.com",
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
    },
    {
      "id": "node-2",
      "host": "jwt-service-2.example.com",
      "port": 8000,
      "region": "us-west-2",
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
    },
    {
      "id": "node-3",
      "host": "jwt-service-3.example.com",
      "port": 8000,
      "region": "eu-central-1",
      "status": "active",
      "endpoints": {
        "issue": "/issue",
        "verify": "/verify",
        "jwks": "/.well-known/jwks.json",
        "health": "/health"
      },
      "metadata": {
        "deployment_type": "cloud-run",
        "min_instances": 1
      }
    }
  ]
}
```

## 利用方法

### クライアントでの利用

1. JWT Serviceノード情報JSONを取得します
2. 利用可能なノードから適切なノードを選択します（例：リージョンに基づく選択）
3. 選択したノードのホスト名とエンドポイントを使用してAPIリクエストを行います
4. 認証情報に基づいて適切な認証ヘッダーを設定します

### 例：トークン発行リクエスト

```javascript
// ノード情報JSONからノードを選択
const node = jwtServiceNodes.nodes.find(n => n.region === 'ap-northeast-1' && n.status === 'active');

// APIキーを取得（別途安全な方法で取得）
const apiKey = getApiKeyFromSecureStorage();

// トークン発行リクエスト
const response = await fetch(`https://${node.host}:${node.port}${node.endpoints.issue}`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  },
  body: JSON.stringify({
    sub: 'user123',
    entitlement_id: 'entitlement456'
  })
});

const { token } = await response.json();
```

## セキュリティ上の注意

- このJSONにはAPIキーなどの機密情報を含めないでください
- APIキーは別途安全な方法（AWS Secrets Managerなど）で管理・共有してください
- ノード情報JSONの配布は、信頼できる関係者のみに制限してください
- 定期的にノード情報を更新し、古いノード情報が使用されないようにしてください

## 更新履歴

- 1.0.0 - 初版
