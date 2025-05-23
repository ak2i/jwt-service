echo "Setting up JWT Service development environment..."

if ! command -v deno &> /dev/null; then
    echo "Installing Deno..."
    curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/home/ubuntu/.deno sh -s v1.41.0
    echo 'export DENO_INSTALL="/home/ubuntu/.deno"' >> ~/.bashrc
    echo 'export PATH="$DENO_INSTALL/bin:$PATH"' >> ~/.bashrc
    export DENO_INSTALL="/home/ubuntu/.deno"
    export PATH="$DENO_INSTALL/bin:$PATH"
fi

echo "Caching dependencies..."
deno cache src/deps.ts

echo "Building Docker image..."
docker-compose build

echo "Setup complete! You can now run the service with:"
echo "docker-compose up"
echo ""
echo "Or run it directly with Deno:"
echo "deno task dev"
echo ""
echo "To test the API, run:"
echo "deno run --allow-net src/test_client.ts"
