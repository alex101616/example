import crypto from "crypto";

export function validateProxySignature(request: Request) {
  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams);

  const signature = params.signature;
  delete params.signature;

  const msg = Object.keys(params)
    .sort()
    .map(k => `${k}=${params[k]}`)
    .join("");

  const digest = crypto
    .createHmac("sha256", process.env.SHOPIFY_API_SECRET!)
    .update(msg)
    .digest("hex");

  return digest === signature;
}


export function validateShop(request: Request) {
  const shop = new URL(request.url).searchParams.get("shop");

  return shop === `${process.env.SHOPIFY_ID}.myshopify.com`;
}


export function validateProxyRequest(request: Request) {
  if (!validateProxySignature(request)) {
    throw new Response("Invalid proxy signature", { status: 401 });
  }

  if (!validateShop(request)) {
    throw new Response("Invalid shop", { status: 401 });
  }
}
