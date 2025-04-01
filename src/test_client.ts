

const BASE_URL = "http://localhost:8000";

async function login(username: string, password: string): Promise<string> {
  const response = await fetch(`${BASE_URL}/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, password }),
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(`Login failed: ${data.error}`);
  }
  
  return data.token;
}

async function accessProtectedEndpoint(token: string): Promise<Record<string, unknown>> {
  const response = await fetch(`${BASE_URL}/api/protected`, {
    headers: {
      "Authorization": `Bearer ${token}`,
    },
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(`Failed to access protected endpoint: ${data.error}`);
  }
  
  return data;
}

async function main() {
  try {
    console.log("Testing JWT service...");
    
    const healthResponse = await fetch(`${BASE_URL}/health`);
    const healthData = await healthResponse.json();
    console.log("Health check:", healthData);
    
    console.log("Logging in with test credentials...");
    const token = await login("test", "password");
    console.log("Received token:", token.substring(0, 20) + "...");
    
    console.log("Accessing protected endpoint...");
    const protectedData = await accessProtectedEndpoint(token);
    console.log("Protected endpoint response:", protectedData);
    
    console.log("All tests passed successfully!");
  } catch (error) {
    console.error("Test failed:", error.message);
  }
}

if (import.meta.main) {
  main();
}
