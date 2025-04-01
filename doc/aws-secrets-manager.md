# API Key Management with AWS Secrets Manager for ECS Deployment

This document outlines the recommended approach for securely managing API keys for the JWT service when deployed to AWS ECS.

## Storing API Keys in AWS Secrets Manager

1. **Create a secret in AWS Secrets Manager**:

   ```bash
   aws secretsmanager create-secret \
     --name jwt-service/api-keys \
     --description "API keys for JWT service" \
     --secret-string '{"API_KEY_CURRENT":"your-secure-api-key-1","API_KEY_PREVIOUS":"your-secure-api-key-2"}'
   ```

   You can use the included CLI tool to generate secure API keys:
   
   ```bash
   deno run --allow-env --allow-hrtime cli/generate-api-key.ts
   ```

2. **Update the secret for key rotation**:

   When rotating keys, you should move the current key to previous and set a new current key:
   
   ```bash
   # Generate a new API key
   NEW_API_KEY=$(deno run --allow-env --allow-hrtime cli/generate-api-key.ts)
   
   # Get the current secret value
   CURRENT_SECRET=$(aws secretsmanager get-secret-value \
     --secret-id jwt-service/api-keys \
     --query SecretString \
     --output text)
   
   # Extract the current key to become the previous key
   CURRENT_KEY=$(echo $CURRENT_SECRET | jq -r '.API_KEY_CURRENT')
   
   # Update the secret with new values
   aws secretsmanager update-secret \
     --secret-id jwt-service/api-keys \
     --secret-string "{\"API_KEY_CURRENT\":\"$NEW_API_KEY\",\"API_KEY_PREVIOUS\":\"$CURRENT_KEY\"}"
   ```

## Configuring ECS Task Definitions

Configure your ECS task definition to inject the API keys as environment variables:

```json
{
  "containerDefinitions": [
    {
      "name": "jwt-service",
      "image": "your-ecr-repo/jwt-service:latest",
      "secrets": [
        {
          "name": "API_KEY_CURRENT",
          "valueFrom": "arn:aws:secretsmanager:region:account-id:secret:jwt-service/api-keys:API_KEY_CURRENT::"
        },
        {
          "name": "API_KEY_PREVIOUS",
          "valueFrom": "arn:aws:secretsmanager:region:account-id:secret:jwt-service/api-keys:API_KEY_PREVIOUS::"
        }
      ]
    }
  ]
}
```

## IAM Permissions

Ensure your ECS task role has the necessary permissions to access the secret:

```json
{
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
}
```

## Security Considerations

1. Always use the principle of least privilege for IAM policies
2. Consider enabling secret rotation in AWS Secrets Manager
3. Use parameter filters to only retrieve the specific keys needed
4. Monitor API key usage and set up alerts for unusual patterns
5. Don't log API keys or include them in error messages
