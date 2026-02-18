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

    return { "url": url , "param": Object.fromEntries(url.searchParams) , "secret": process.env.SHOPIFY_API_SECRET }
  return digest === signature;
}


//export function validateShop(request: Request) {
//  const shop = new URL(request.url).searchParams.get("shop");

//  return shop === `${process.env.SHOPIFY_ID}.myshopify.com`;
//}


export function validateShop(request: Request) {
  const shop = new URL(request.url).searchParams.get("shop");

  return (
    shop === `${process.env.SHOPIFY_ID}.myshopify.com` ||
    shop === `${process.env.SHOPIFY_ID2}.myshopify.com`
  );
}


export function validateLoggedCustomer(request: Request) {
  const customerId = new URL(request.url)
    .searchParams.get("logged_in_customer_id");

  if (!customerId) {
    throw new Response("No logged customer", { status: 401 });
  }

  return true;
}


export function validateProxyRequest(request: Request) {
  //if (!validateProxySignature(request)) {
      const url = new URL(request.url);
    throw new Response(  JSON.stringify({
    url: url.toString(),
    param: Object.fromEntries(url.searchParams),
    secret: process.env.SHOPIFY_API_SECRET
  }), { status: 401,
 headers: {
      "Content-Type": "application/json"
    }

   });
 // }

  if (!validateShop(request)) {
    throw Response.json({ error: "Invalid shop" }, { status: 401 });
  }

  validateLoggedCustomer(request);

}
