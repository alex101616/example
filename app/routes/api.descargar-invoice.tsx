import { getAdminToken } from "app/lib/adminClient";
import { graphqlWithRetry } from "app/utils/graphqlRetry";
import { validateProxyRequest } from "app/utils/proxyValidator";

export const loader = async ({ request }: any) => {

  validateProxyRequest(request);

  let orderId = new URL(request.url)
    .searchParams.get("order_id");

  if (!orderId) {
    return Response.json(
      { error: "Debe enviar order_id" },
      { status: 400 }
    );
  }

  if (!orderId.startsWith("gid://")) {
    orderId = `gid://shopify/Order/${orderId}`;
  }

  let token = await getAdminToken();

  const graphql = (query: string, variables?: any) =>
    fetch(
      `https://${process.env.SHOPIFY_ID}.myshopify.com/admin/api/${process.env.SHOPIFY_API_VERSION}/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": token
        },
        body: JSON.stringify({ query, variables })
      }
    );

  const updateToken = (t: string) => {
    token = t;
  };

  try {

    /* ===== 1. OBTENER METAFIELD ===== */
    const res = await graphqlWithRetry(
      graphql,
      updateToken,
      `
      query ($id: ID!) {
        order(id: $id) {
          metafield(namespace:"custom", key:"invoice") {
            value
          }
        }
      }
      `,
      { id: orderId }
    );

    const json = await res.json();
    const mediaGid =
      json?.data?.order?.metafield?.value;

    if (!mediaGid) {
      return Response.json(
        { error: "Pedido sin invoice" },
        { status: 404 }
      );
    }

    /* ===== 2. OBTENER URL REAL ===== */
    const fileRes = await graphqlWithRetry(
      graphql,
      updateToken,
      `
      query ($id: ID!) {
        node(id: $id) {
          __typename
          ... on MediaImage {
            image { url }
          }
          ... on GenericFile {
            url
            mimeType
          }
        }
      }
      `,
      { id: mediaGid }
    );

    const fileJson = await fileRes.json();
    const node = fileJson?.data?.node;

    let url: string | null = null;
    let mimeType: string | null = null;

    if (node?.__typename === "MediaImage") {
      url = node.image?.url;
      mimeType = "image/*";
    }

    if (node?.__typename === "GenericFile") {
      url = node.url;
      mimeType = node.mimeType;
    }

    if (!url) {
      return Response.json(
        { error: "No se pudo obtener URL archivo" },
        { status: 500 }
      );
    }

    /* ===== 3. DESCARGAR (RETRY) ===== */

    const download = await fetchWithRetry(url, 3);

    const contentType =
      download.headers.get("content-type") ||
      mimeType ||
      "application/octet-stream";

    const buffer = await download.arrayBuffer();

    const ext =
      contentType.split("/")[1] || "file";

    const filename =
      `invoice-${orderId.split("/").pop()}.${ext}`;

    return new Response(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition":
          `attachment; filename="${filename}"`
      }
    });

  } catch (error: any) {

    console.error(error);

    return Response.json(
      {
        ok: false,
        error: "Error descargando invoice",
        debug: error?.message || error
      },
      { status: 500 }
    );
  }
};


/* ===== RETRY FETCH ===== */
async function fetchWithRetry(
  url: string,
  retries = 3,
  delay = 800
): Promise<Response> {

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res;

  } catch (err) {

    if (retries <= 0) throw err;

    await new Promise(r => setTimeout(r, delay));

    return fetchWithRetry(url, retries - 1, delay * 2);
  }
}
