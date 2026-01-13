import { createToken } from "./shopifyToken";

let cachedToken: string | null = null;

export async function getAdminToken() {

  if (cachedToken) {
    return cachedToken;
  }

  const token = await createToken();
  cachedToken = token;

  return token;
}

export async function setAdminToken(token: string) {
  cachedToken = token;
}
