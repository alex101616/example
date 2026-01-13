// app/lib/shopifyToken.ts
export async function createToken() {
  const client_id = process.env.SHOPIFY_API_KEY!;
  const client_secret = process.env.SHOPIFY_API_SECRET!;
  const shopify_id  = process.env.SHOPIFY_ID!;

  const res = await fetch(
    `https://${shopify_id}.myshopify.com/admin/oauth/access_token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        client_id,
        client_secret,
        grant_type: "client_credentials"
      })
    }
  );

  if (!res.ok) {
    throw new Error("No se pudo generar token" + await res.text());
  }

  const data = await res.json();

  return data.access_token;
}
