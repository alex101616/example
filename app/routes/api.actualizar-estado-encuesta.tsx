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

    /* ===== 1. VER SI YA EXISTE ===== */
    const checkRes = await graphqlWithRetry(
      graphql,
      updateToken,
      `
      query ($id: ID!) {
        order(id: $id) {
          metafield(namespace:"custom", key:"is_survey") {
            id
            value
          }
        }
      }
      `,
      { id: orderId }
    );

    const checkJson = await checkRes.json();
    const exists =
      !!checkJson?.data?.order?.metafield;

    /* ===== 2. SET (CREATE / UPDATE) ===== */
    const res = await graphqlWithRetry(
      graphql,
      updateToken,
      `
      mutation ($ownerId: ID!) {
        metafieldsSet(metafields: [{
          namespace: "custom",
          key: "is_survey",
          type: "number_integer",
          value: "1",
          ownerId: $ownerId
        }]) {
          metafields { id value }
          userErrors { field message }
        }
      }
      `,
      { ownerId: orderId }
    );

    const json = await res.json();
    const errors = json?.data?.metafieldsSet?.userErrors;

    if (errors?.length) {
      return Response.json({
        ok: false,
        shopifyErrors: errors
      }, { status: 400 });
    }

    return Response.json({
      isUpdate: exists,
    });

  } catch (error: any) {

    console.error(error);

    return Response.json(
      {
        ok: false,
        error: "Error actualizando is_survey",
        debug: error?.message || error
      },
      { status: 500 }
    );
  }
};
