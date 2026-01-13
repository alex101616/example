import { getAdminToken } from "app/lib/adminClient";
import { graphqlWithRetry } from "app/utils/graphqlRetry";
import { validateProxyRequest } from "app/utils/proxyValidator";

export const loader = async ({ request }: any) => {

  validateProxyRequest(request);

  const customerId = new URL(request.url)
    .searchParams.get("customer_id");

  if (!customerId) {
    return Response.json(
      { error: "Debe enviar customer_id" },
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

    /* ===== 1. OBTENER ÚLTIMA ORDEN ===== */
    const orderRes = await graphqlWithRetry(
      graphql,
      updateToken,
      `
      query ($query: String!) {
        orders(first: 1, reverse: true, query: $query) {
          edges {
            node {
              id
              name
              metafield(
                namespace: "custom",
                key: "is_survey"
              ) {
                value
              }
            }
          }
        }
      }
      `,
      {
        query: `customer_id:${customerId}`
      }
    );

    const orderJson = await orderRes.json();
    const order =
      orderJson?.data?.orders?.edges?.[0]?.node;

    if (!order) {
      return Response.json({
        ok: false,
        message: "Cliente sin órdenes"
      });
    }

    const flag = order.metafield?.value;

    /* ===== 2. SI YA RESPONDIÓ ===== */
    if (flag === "1") {
      return Response.json({
        showSurvey: false,
      });
    }

    /* ===== 3. TRAER ENCUESTAS ===== */
    const encuestasRes = await graphqlWithRetry(
      graphql,
      updateToken,
      `
      query {
        shop {
          metafield(namespace:"surveys", key:"questions") {
            value
          }
        }
      }
      `
    );

    const encJson = await encuestasRes.json();

    const raw = encJson?.data?.shop?.metafield?.value
      ? JSON.parse(encJson.data.shop.metafield.value)
      : [];

    const preguntas = raw.filter(Boolean);

    return Response.json({
      ok: true,
      showSurvey: true,
      orderId: order.id,
      preguntas
    });

  } catch (error) {

    console.error(error);

    return Response.json(
      { ok: false, error: "Error validando encuesta" },
      { status: 500 }
    );
  }
};
