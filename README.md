# JWT Service

A REST API service for JWT (JSON Web Token) authentication using Deno and Hono.

## Features

- JWT token generation and validation
- Protected API endpoints
- CORS support
- Docker support for local development
- Deno for both server and client testing

## Prerequisites

- [Deno](https://deno.land/) v1.41.0 or higher
- [Docker](https://www.docker.com/) and Docker Compose (for containerized development)

## Development Setup

### Using Deno directly

1. Install Deno:
   ```
   curl -fsSL https://deno.land/x/install/install.sh | sh
   ```

2. Start the server:
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
deno run --allow-net src/test_client.ts
```

### API Endpoints

- `GET /health` - Health check endpoint
- `POST /login` - Login to get a JWT token
  - Request body: `{ "username": "test", "password": "password" }`
  - Response: `{ "token": "your-jwt-token" }`
- `GET /api/protected` - Protected endpoint (requires JWT authentication)
  - Header: `Authorization: Bearer your-jwt-token`
  - Response: `{ "message": "This is a protected endpoint", "user": { ... } }`

## Environment Variables

- `PORT` - Server port (default: 8000)
- `JWT_SECRET` - Secret key for JWT signing (default: "your-secret-key")

## Deployment

This service is designed to be deployed on AWS ECS. Deployment instructions will be added in the future.

## License

MIT
