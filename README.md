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
| HOSTNAME           | Server hostname                      | ::         |
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

   Deno tasks for this project are defined in `deno.json` at the repository root.

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
deno run --allow-net --allow-env --allow-read src/test_client.ts
```

## CLI Tools

### Generate API Key

Generate a secure random API key for use with the JWT service:

```
mkdir -p workdir
deno run --allow-env cli/generate-api-key.ts > workdir/api-key.txt
```

This generates a cryptographically secure random API key suitable for use in
HTTP headers.

### Generate Key Pair

Generate an RSA private key and the corresponding public key:

```
mkdir -p workdir
deno run --allow-env cli/generate-private-key.ts > workdir/keypair.json
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

[Amazon Elastic Container Service (ECS)](https://aws.amazon.com/ecs/) provides a scalable container orchestration service for running Docker containers in AWS.

#### Prerequisites

1. Install the AWS CLI:
   ```bash
   curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
   unzip awscliv2.zip
   sudo ./aws/install
   ```

2. Configure AWS CLI with your credentials:
   ```bash
   aws configure
   ```

3. Install Docker CLI:
   ```bash
   sudo apt-get update
   sudo apt-get install docker.io
   ```

4. Required AWS IAM permissions:
   - `ecr:*` - For ECR repository operations
   - `ecs:*` - For ECS cluster and service operations
   - `secretsmanager:*` - For Secrets Manager operations
   - `iam:PassRole` - For assigning roles to ECS tasks

#### ECR Repository Creation

1. Create an ECR repository for the JWT service:
   ```bash
   aws ecr create-repository \
     --repository-name jwt-service \
     --image-scanning-configuration scanOnPush=true
   ```

2. Get the ECR repository URI:
   ```bash
   ECR_REPO=$(aws ecr describe-repositories \
     --repository-names jwt-service \
     --query 'repositories[0].repositoryUri' \
     --output text)
   echo $ECR_REPO
   ```

3. Authenticate Docker to your ECR registry:
   ```bash
   aws ecr get-login-password --region $(aws configure get region) | \
   docker login --username AWS --password-stdin $ECR_REPO
   ```

#### Docker Image Build and Push

1. Build the Docker image using the provided Dockerfile:
   ```bash
   docker build -t jwt-service -f docker/Dockerfile .
   ```

2. Tag the image for ECR:
   ```bash
   docker tag jwt-service:latest $ECR_REPO:latest
   ```

3. Push the image to ECR:
   ```bash
   docker push $ECR_REPO:latest
   ```

#### Secrets Manager Configuration

1. Generate a secure API key:
   ```bash
   mkdir -p workdir
   deno run --allow-env --allow-hrtime cli/generate-api-key.ts > workdir/api-key.txt
   ```

2. Generate RSA key pair for JWT signing:
   ```bash
   deno run --allow-env cli/generate-private-key.ts > workdir/keypair.json
   ```

3. Store the keys in AWS Secrets Manager:
   ```bash
   # Store API keys
   aws secretsmanager create-secret \
     --name jwt-service/api-keys \
     --description "API keys for JWT service" \
     --secret-string "{\"API_KEY_CURRENT\":\"$(cat workdir/api-key.txt)\",\"API_KEY_PREVIOUS\":\"\"}"

   # Store RSA keys
   PRIVATE_KEY=$(jq -r '.privateKey' workdir/keypair.json)
   PUBLIC_KEY=$(jq -r '.publicKey' workdir/keypair.json)
   
   aws secretsmanager create-secret \
     --name jwt-service/rsa-keys \
     --description "RSA keys for JWT service" \
     --secret-string "{\"PRIVATE_KEY_PEM\":\"$PRIVATE_KEY\",\"PUBLIC_KEY_PEM\":\"$PUBLIC_KEY\",\"KEY_ID\":\"ecs-key-1\"}"
   ```

For more detailed information on API key management with AWS Secrets Manager, see
[AWS Secrets Manager Integration](./doc/aws-secrets-manager.md).

#### ECS Task Definition

1. Create an IAM role for the ECS task:
   ```bash
   # Create a trust policy file
   cat > trust-policy.json << EOF
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Principal": {
           "Service": "ecs-tasks.amazonaws.com"
         },
         "Action": "sts:AssumeRole"
       }
     ]
   }
   EOF

   # Create the role
   aws iam create-role \
     --role-name jwt-service-task-role \
     --assume-role-policy-document file://trust-policy.json

   # Attach the Secrets Manager policy
   aws iam put-role-policy \
     --role-name jwt-service-task-role \
     --policy-name jwt-service-secrets-policy \
     --policy-document '{
       "Version": "2012-10-17",
       "Statement": [
         {
           "Effect": "Allow",
           "Action": [
             "secretsmanager:GetSecretValue"
           ],
           "Resource": "arn:aws:secretsmanager:*:*:secret:jwt-service/*"
         }
       ]
     }'
   ```

2. Create a task definition JSON file:
   ```bash
   cat > jwt-service-task-definition.json << EOF
   {
     "family": "jwt-service",
     "networkMode": "awsvpc",
     "executionRoleArn": "arn:aws:iam::<YOUR_ACCOUNT_ID>:role/ecsTaskExecutionRole",
     "taskRoleArn": "arn:aws:iam::<YOUR_ACCOUNT_ID>:role/jwt-service-task-role",
     "containerDefinitions": [
       {
         "name": "jwt-service",
         "image": "${ECR_REPO}:latest",
         "essential": true,
         "portMappings": [
           {
             "containerPort": 8000,
             "hostPort": 8000,
             "protocol": "tcp"
           }
         ],
         "environment": [
           {
             "name": "PORT",
             "value": "8000"
           },
           {
             "name": "DEFAULT_EXPIRATION",
             "value": "3600"
           }
         ],
         "secrets": [
           {
             "name": "API_KEY_CURRENT",
             "valueFrom": "arn:aws:secretsmanager:<REGION>:<YOUR_ACCOUNT_ID>:secret:jwt-service/api-keys:API_KEY_CURRENT::"
           },
           {
             "name": "API_KEY_PREVIOUS",
             "valueFrom": "arn:aws:secretsmanager:<REGION>:<YOUR_ACCOUNT_ID>:secret:jwt-service/api-keys:API_KEY_PREVIOUS::"
           },
           {
             "name": "PRIVATE_KEY_PEM",
             "valueFrom": "arn:aws:secretsmanager:<REGION>:<YOUR_ACCOUNT_ID>:secret:jwt-service/rsa-keys:PRIVATE_KEY_PEM::"
           },
           {
             "name": "PUBLIC_KEY_PEM",
             "valueFrom": "arn:aws:secretsmanager:<REGION>:<YOUR_ACCOUNT_ID>:secret:jwt-service/rsa-keys:PUBLIC_KEY_PEM::"
           },
           {
             "name": "KEY_ID",
             "valueFrom": "arn:aws:secretsmanager:<REGION>:<YOUR_ACCOUNT_ID>:secret:jwt-service/rsa-keys:KEY_ID::"
           }
         ],
         "logConfiguration": {
           "logDriver": "awslogs",
           "options": {
             "awslogs-group": "/ecs/jwt-service",
             "awslogs-region": "<REGION>",
             "awslogs-stream-prefix": "ecs"
           }
         },
         "healthCheck": {
           "command": ["CMD-SHELL", "curl -f http://localhost:8000/health || exit 1"],
           "interval": 30,
           "timeout": 5,
           "retries": 3,
           "startPeriod": 60
         }
       }
     ],
     "requiresCompatibilities": ["FARGATE"],
     "cpu": "256",
     "memory": "512"
   }
   EOF

   # Replace placeholders with actual values
   sed -i "s/<YOUR_ACCOUNT_ID>/$(aws sts get-caller-identity --query Account --output text)/g" jwt-service-task-definition.json
   sed -i "s/<REGION>/$(aws configure get region)/g" jwt-service-task-definition.json

   # Register the task definition
   aws ecs register-task-definition --cli-input-json file://jwt-service-task-definition.json
   ```

#### ECS Cluster and Service Creation

1. Create an ECS cluster:
   ```bash
   aws ecs create-cluster --cluster-name jwt-service-cluster
   ```

2. Create a security group for the service:
   ```bash
   # Create a security group
   SG_ID=$(aws ec2 create-security-group \
     --group-name jwt-service-sg \
     --description "Security group for JWT service" \
     --vpc-id <YOUR_VPC_ID> \
     --query 'GroupId' \
     --output text)

   # Allow inbound traffic on port 8000
   aws ec2 authorize-security-group-ingress \
     --group-id $SG_ID \
     --protocol tcp \
     --port 8000 \
     --cidr 0.0.0.0/0
   ```

3. Create the ECS service:
   ```bash
   # Get subnet IDs for your VPC
   SUBNET_IDS=$(aws ec2 describe-subnets \
     --filters "Name=vpc-id,Values=<YOUR_VPC_ID>" \
     --query 'Subnets[*].SubnetId' \
     --output json | jq -c .)

   # Create the service
   aws ecs create-service \
     --cluster jwt-service-cluster \
     --service-name jwt-service \
     --task-definition jwt-service:1 \
     --desired-count 2 \
     --launch-type FARGATE \
     --network-configuration "awsvpcConfiguration={subnets=$SUBNET_IDS,securityGroups=[$SG_ID],assignPublicIp=ENABLED}" \
     --scheduling-strategy REPLICA
   ```

4. (Optional) Create a load balancer:
   ```bash
   # Create a load balancer
   aws elbv2 create-load-balancer \
     --name jwt-service-lb \
     --subnets <SUBNET_ID_1> <SUBNET_ID_2> \
     --security-groups $SG_ID \
     --type application

   # Create a target group
   aws elbv2 create-target-group \
     --name jwt-service-tg \
     --protocol HTTP \
     --port 8000 \
     --vpc-id <YOUR_VPC_ID> \
     --target-type ip \
     --health-check-path /health

   # Create a listener
   aws elbv2 create-listener \
     --load-balancer-arn <LOAD_BALANCER_ARN> \
     --protocol HTTP \
     --port 80 \
     --default-actions Type=forward,TargetGroupArn=<TARGET_GROUP_ARN>

   # Update the service to use the load balancer
   aws ecs update-service \
     --cluster jwt-service-cluster \
     --service jwt-service \
     --load-balancers "targetGroupArn=<TARGET_GROUP_ARN>,containerName=jwt-service,containerPort=8000"
   ```

#### Deployment Verification

1. Check the service status:
   ```bash
   aws ecs describe-services \
     --cluster jwt-service-cluster \
     --services jwt-service
   ```

2. Generate JWT Service nodes information JSON for AWS ECS:
   ```bash
   deno run --allow-env --allow-read --allow-run cli/generate-nodes-json.ts aws-ecs \
     --region $(aws configure get region) \
     --host-prefix $(aws elbv2 describe-load-balancers \
       --names jwt-service-lb \
       --query 'LoadBalancers[0].DNSName' \
       --output text) \
     --count 2
   ```

3. ノード情報JSONから各ノードの疎通確認を行う例:
   ```bash
   deno run --allow-net --allow-read cli/test_nodes_from_json.ts workdir/nodes-aws-ecs.json workdir/api-key.txt
   ```

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
2. Edit `fly.toml` to run in production mode:
   ```toml
   [env]
     DENO_ENV = "production"
   ```
   This prevents `.env` loading and uses the secrets you configure.


2. Configure secrets for your private keys and API keys. **Newline characters in
   the PEM file must be preserved**:

   ```bash
   fly secrets set PRIVATE_KEY_PEM="your-privateKey"
   fly secrets set PUBLIC_KEY_PEM="your-publicKey"
   fly secrets set API_KEY_CURRENT="your-secure-api-key"
   ```

4. Deploy your application:
   ```bash
   fly deploy
   ```

5. Scale to multiple regions for redundancy (optional):
   ```bash
   fly regions add nrt fra syd
   ```

6. Scale to multiple instances per region (optional):
   ```bash
   fly scale count 3
   ```

7. ノード情報JSONから各ノードの疎通確認を行う例:

   ```bash
   deno run --allow-net --allow-read cli/test_nodes_from_json.ts workdir/nodes-flyio.json workdir/api-key.txt
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
