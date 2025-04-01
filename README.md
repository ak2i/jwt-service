# JWT Service

A stateless JWT service for issuing and verifying JWTs, built with Deno and Hono.

## Features

- Issue JWTs with RS256 signing
- Verify JWTs
- JWKS endpoint for public key distribution
- API key authentication for token issuance
- API key rotation support
- Configurable token expiration
- Environment variable configuration
- CORS support
- Docker support for local development

## Prerequisites

- [Deno](https://deno.land/) v1.41.0 or higher
- [Docker](https://www.docker.com/) and Docker Compose (for containerized development)

## API Endpoints

- `POST /issue` - Issue a new JWT (requires API key)
  - Header: `Authorization: Bearer {API_KEY}`
  - Request body: `{ "sub": "user123", "entitlement_id": "entitlement456", "exp": 1714546789 }`
  - Response: `{ "token": "your-jwt-token" }`
- `POST /verify` - Verify a JWT
  - Request body: `{ "token": "your-jwt-token" }`
  - Response: `{ "valid": true, "payload": { ... } }`
- `GET /.well-known/jwks.json` - Get JWKS public keys
  - Response: `{ "keys": [ { "kty": "RSA", ... } ] }`
- `GET /health` - Health check endpoint
  - Response: `{ "status": "ok" }`

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Server port | 8000 |
| API_KEY | API key for /issue endpoint (legacy) | dev-api-key |
| API_KEY_CURRENT | Current API key for /issue endpoint | Same as API_KEY |
| API_KEY_PREVIOUS | Previous API key (for rotation) | Empty |
| PRIVATE_KEY_PEM | Private key in PEM format | Auto-generated in dev |
| PUBLIC_KEY_PEM | Public key in PEM format | Derived from private key |
| KEY_ID | Key ID for JWKS | default-key-1 |
| DEFAULT_EXPIRATION | Default token expiration | 600 |

## Development Setup

### Using Deno directly

1. Install Deno:
   ```
   curl -fsSL https://deno.land/x/install/install.sh | sh
   ```

2. Create a `.env` file with your configuration (see above environment variables)

3. Start the server:
   ```
   deno task start
   ```

   Or for development with watch mode:
   ```
   deno task dev
   ```

### Using Docker Compose

1. Build and start the container:
   ```
   docker-compose up --build
   ```

## Testing

### Run the test client

```
deno run --allow-net --allow-env src/test_client.ts
```

## CLI Tools

### Generate API Key

Generate a secure random API key for use with the JWT service:

```
deno run --allow-env --allow-hrtime cli/generate-api-key.ts
```

This generates a cryptographically secure random API key suitable for use in HTTP headers.

## Deployment

This service is designed to be deployed on AWS ECS. The service is stateless and can be scaled horizontally. Private keys should be provided via environment variables in the ECS task definition.

For secure API key management in production, see [AWS Secrets Manager Integration](./doc/aws-secrets-manager.md).

## License

MIT
