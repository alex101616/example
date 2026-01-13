import { getAdminToken } from "app/lib/adminClient";
import { graphqlWithRetry } from "app/utils/graphqlRetry";
import { validateProxyRequest } from "app/utils/proxyValidator";

export const loader = async ({ request }: any) => {

  validateProxyRequest(request); // activar en prod

  const url = new URL(request.url);

  let orderId = url.searchParams.get("order_id");
  const answersRaw = url.searchParams.get("answers");

  if (!orderId || !answersRaw) {
    return Response.json(
      { error: "Debe enviar order_id y answers" },
      { status: 400 }
    );
  }

  /* ===== NORMALIZAR GID ===== */
  if (!orderId.startsWith("gid://")) {
    orderId = `gid://shopify/Order/${orderId}`;
  }

  let answers;

  try {
    answers = JSON.parse(answersRaw);
  } catch {
    return Response.json(
      { error: "Formato answers inválido (JSON)" },
      { status: 400 }
    );
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

    const res = await graphqlWithRetry(
      graphql,
      updateToken,
      `
      mutation ($ownerId: ID!, $value: String!) {
        metafieldsSet(metafields: [{
          namespace: "custom",
          key: "survey_answers",
          type: "json",
          value: $value,
          ownerId: $ownerId
        }]) {
          metafields { id }
          userErrors { field message }
        }
      }
      `,
      {
        ownerId: orderId,
        value: JSON.stringify(answers)
      }
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
      saved: true
    });

  } catch (error: any) {

    console.error(error);

    return Response.json(
      {
        ok: false,
        error: "Error guardando respuestas",
        debug: error?.message || error
      },
      { status: 500 }
    );
  }
};
