FROM denoland/deno:2.2.6

WORKDIR /app

# Cache the dependencies
COPY src/deps.ts .
RUN deno cache deps.ts

# Copy source code
COPY src/ src/

# Compile the main app so that it doesn't need to be compiled each startup/entry
RUN deno cache src/main.ts

EXPOSE 8000

CMD ["run", "--allow-net", "--allow-env", "src/main.ts"]
