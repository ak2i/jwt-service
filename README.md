# JWT Service

A stateless JWT service for issuing and verifying JWTs, built with Deno and
Hono.

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
- [Docker](https://www.docker.com/) and Docker Compose (for containerized
  development)

## API Endpoints

- `POST /issue` - Issue a new JWT (requires API key)
  - Header: `Authorization: Bearer {API_KEY}`
  - Request body:
    `{ "sub": "user123", "entitlement_id": "entitlement456", "exp": 1714546789 }`
  - Response: `{ "token": "your-jwt-token" }`
- `POST /verify` - Verify a JWT
  - Request body: `{ "token": "your-jwt-token" }`
  - Response: `{ "valid": true, "payload": { ... } }`
- `GET /.well-known/jwks.json` - Get JWKS public keys
  - Response: `{ "keys": [ { "kty": "RSA", ... } ] }`
- `GET /health` - Health check endpoint
  - Response: `{ "status": "ok" }`

## Environment Variables

| Variable           | Description                          | Default                  |
| ------------------ | ------------------------------------ | ------------------------ |
| PORT               | Server port                          | 8000                     |
| API_KEY            | API key for /issue endpoint (legacy) | dev-api-key              |
| API_KEY_CURRENT    | Current API key for /issue endpoint  | Same as API_KEY          |
| API_KEY_PREVIOUS   | Previous API key (for rotation)      | NONE                     |
| PRIVATE_KEY_PEM    | Private key in PEM format            | Auto-generated in dev    |
| PUBLIC_KEY_PEM     | Public key in PEM format             | Derived from private key |
| KEY_ID             | Key ID for JWKS                      | default-key-1            |
| DEFAULT_EXPIRATION | Default token expiration             | 600                      |

## Development Setup

### Using Deno directly

1. Install Deno:
   ```
   curl -fsSL https://deno.land/x/install/install.sh | sh
   ```

2. Create a `.env` file with your configuration (see above environment
   variables)

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
   docker compose up --build
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

This generates a cryptographically secure random API key suitable for use in
HTTP headers.

### Generate Key Pair

Generate an RSA private key and the corresponding public key:

```
deno run --allow-env --allow-hrtime cli/generate-private-key.ts > keypair.json
```

The output is a JSON object with `privateKey` and `publicKey` fields. Set the
`MODULUS_LENGTH` environment variable to change the key size (defaults to 2048
bits).

### Generate Nodes JSON

Generate JWT Service nodes information JSON for different deployment methods:

```
# AWS ECS deployment
deno run --allow-env --allow-read --allow-run cli/generate-nodes-json.ts aws-ecs --region ap-northeast-1,us-west-2 --count 2

# Fly.io deployment
deno run --allow-env --allow-read --allow-run cli/generate-nodes-json.ts flyio --region nrt,fra,syd --host jwt-service.fly.dev

# Google Cloud Run deployment
deno run --allow-env --allow-read --allow-run cli/generate-nodes-json.ts cloud-run --region us-central1,asia-northeast1
```

This generates a JSON file based on the schema defined in
[doc/jwt-service-nodes.md](./doc/jwt-service-nodes.md) with deployment-specific
configuration.

## Deployment

This service can be deployed using various cloud platforms. Below are
instructions for AWS ECS, Fly.io, and Google Cloud Run.

### AWS ECS Deployment

This service is designed to be deployed on AWS ECS. The service is stateless and
can be scaled horizontally. Private keys should be provided via environment
variables in the ECS task definition.

For secure API key management in production, see
[AWS Secrets Manager Integration](./doc/aws-secrets-manager.md).

### Fly.io Deployment

[Fly.io](https://fly.io/) offers a simple way to deploy Docker containers with
global distribution.

#### Prerequisites

1. Install the Fly CLI:
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. Login to Fly.io:
   ```bash
   fly auth login
   ```

#### Deployment Steps

1. Initialize your Fly.io app (run this in the project root):
   ```bash
   fly launch --dockerfile docker/Dockerfile
   ```
   - This will create a `fly.toml` file in your project

2. Configure secrets for your private keys and API keys:
   ```bash
   fly secrets set PRIVATE_KEY_PEM="$(cat /path/to/your/private_key.pem)"
   fly secrets set API_KEY_CURRENT="your-secure-api-key"
   ```

3. Deploy your application:
   ```bash
   fly deploy
   ```

4. Scale to multiple regions for redundancy (optional):
   ```bash
   fly regions add nrt fra syd
   ```

5. Scale to multiple instances per region (optional):
   ```bash
   fly scale count 3
   ```

### Google Cloud Run Deployment

[Google Cloud Run](https://cloud.google.com/run) is a fully managed platform for
containerized applications.

#### Prerequisites

1. Install the Google Cloud SDK:
   ```bash
   curl https://sdk.cloud.google.com | bash
   ```

2. Initialize the SDK and login:
   ```bash
   gcloud init
   ```

3. Enable required APIs:
   ```bash
   gcloud services enable run.googleapis.com secretmanager.googleapis.com
   ```

#### Deployment Steps

1. Store your secrets in Secret Manager:
   ```bash
   # Create secrets
   echo -n "your-private-key-content" | gcloud secrets create jwt-private-key --data-file=-
   echo -n "your-api-key" | gcloud secrets create jwt-api-key --data-file=-

   # Grant access to the service account
   gcloud secrets add-iam-policy-binding jwt-private-key \
     --member="serviceAccount:YOUR_PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
     --role="roles/secretmanager.secretAccessor"

   gcloud secrets add-iam-policy-binding jwt-api-key \
     --member="serviceAccount:YOUR_PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
     --role="roles/secretmanager.secretAccessor"
   ```

2. Build and push your Docker image:
   ```bash
   # Set your project ID
   PROJECT_ID=$(gcloud config get-value project)

   # Build the image
   docker build -t gcr.io/$PROJECT_ID/jwt-service -f docker/Dockerfile .

   # Push to Google Container Registry
   docker push gcr.io/$PROJECT_ID/jwt-service
   ```

3. Deploy to Cloud Run:
   ```bash
   gcloud run deploy jwt-service \
     --image gcr.io/$PROJECT_ID/jwt-service \
     --platform managed \
     --allow-unauthenticated \
     --set-secrets="PRIVATE_KEY_PEM=jwt-private-key:latest,API_KEY_CURRENT=jwt-api-key:latest" \
     --min-instances=1 \
     --max-instances=10
   ```

4. Get the service URL:
   ```bash
   gcloud run services describe jwt-service --platform managed --format="value(status.url)"
   ```

## License

MIT
