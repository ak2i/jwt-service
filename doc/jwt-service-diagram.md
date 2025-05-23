# JWT Service 構成図（PlantUML）

このドキュメントでは、PrepZen Lite における JWT Service の最小構成と、秘密鍵の安全な共有・使用方法について PlantUML で可視化します。

---

## ✅ JWT Service 最小構成図（PlantUML）

```plantuml
@startuml
!theme cerulean

package "JWT Service (ECS)" {
  [jwt-service (Deno + Hono)]
  [JWT Signing Module]
  [JWKS Public Endpoint]
}

package "Secrets" {
  [AWS Secrets Manager]
  [SSM Parameter Store] #lightgray
}

package "Consumers" {
  [Entitlement Core]
  [Other API Services]
}

[jwt-service (Deno + Hono)] --> [JWT Signing Module] : issue/verify JWT
[JWT Signing Module] --> [AWS Secrets Manager] : get private key on startup

[jwt-service (Deno + Hono)] --> [JWKS Public Endpoint] : GET /.well-known/jwks.json
[Entitlement Core] --> [JWKS Public Endpoint] : use public key for verification
[Other API Services] --> [JWKS Public Endpoint] : use public key for verification

note left of [AWS Secrets Manager]
 Secrets are encrypted
 and access controlled via IAM
end note

@enduml
```

---

## ✅ 構成の要点

- **jwt-service** は stateless に動作し、ECS 上でスケーラブルに運用可能
- **秘密鍵（Private Key）は Secrets Manager または Parameter Store に格納**
  - 各ECSインスタンス起動時に1回だけ読み込み、メモリに保持
- **署名アルゴリズムはRS256/EdDSAなどを想定**
- **公開鍵は /.well-known/jwks.json で提供**
  - 他のAPIやサービスはこの公開鍵を使ってトークンを検証

---

この構成により、高セキュリティとスケーラビリティを両立したJWTサービスが実現できます。
