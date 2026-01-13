import { getAdminToken } from "app/lib/adminClient";
import { graphqlWithRetry } from "app/utils/graphqlRetry";
import { validateProxyRequest } from "app/utils/proxyValidator";

export const loader = async ({ request }: any) => {


  validateProxyRequest(request);

  const sapId = new URL(request.url).searchParams.get("id_customer_sap");

  if (!sapId) {
    return Response.json(
      { error: "Debe enviar id_customer_sap" },
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


  let customers: any[] = [];
  let hasNext = true;
  let cursor: string | null = null;

  while (hasNext) {

    const res = await graphqlWithRetry(
      graphql,
      updateToken,
      `
      query ($cursor: String) {
        customers(
          first: 250,
          after: $cursor,
          query: "metafield:custom.id_customer_sap=${sapId}"
        ) {
          pageInfo {
            hasNextPage
            endCursor
          }
          edges {
            node {
              id
              displayName
            }
          }
        }
      }`,
      { cursor }
    );

    const json = await res.json();
    const data = json.data.customers;

    customers.push(...data.edges.map((e:any) => e.node));

    hasNext = data.pageInfo.hasNextPage;
    cursor = data.pageInfo.endCursor;
  }

  if (!customers.length) {
    return Response.json({ historial: [] });
  }



  const filter = customers
    .map(c => `customer_id:${extractId(c.id)}`)
    .join(" OR ");

  let orders: any[] = [];
  hasNext = true;
  cursor = null;

  while (hasNext) {

    const res = await graphqlWithRetry(
      graphql,
      updateToken,
      `
      query ($cursor: String, $query: String!) {
        orders(
          first: 250,
          after: $cursor,
          query: $query,
          reverse: true
        ) {
          pageInfo {
            hasNextPage
            endCursor
          }
          edges {
            node {
              name
              createdAt
              totalPriceSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }

              customer {   
                id
                displayName
                email
                phone

                metafields(first: 10) {
                  edges {
                    node {
                      namespace
                      key
                      value
                    }
                  }
                }
              }
            }
          }
        }
      }`,
      { cursor, query: filter }
    );

    const json = await res.json();
    const data = json.data.orders;

    orders.push(...data.edges.map((e:any) => e.node));

    hasNext = data.pageInfo.hasNextPage;
    cursor = data.pageInfo.endCursor;
  }

  /* ================= FORMATEAR ================= */

const historial = orders
  .map(o => {

    const mf = o.customer.metafields;
    const sap = getMetafield(mf, "id_customer_sap");


    if (sap !== sapId) return null;

    return {
      numeroOrden: o.name,
      fecha: o.createdAt,
      total: o.totalPriceSet.shopMoney.amount,
      moneda: o.totalPriceSet.shopMoney.currencyCode,

      customer: {
        id: extractId(o.customer.id),
        nombre: o.customer.displayName,
        email: o.customer.email,
        telefono: o.customer.phone,

        id_customer_sap: sap,
        credito: getMetafield(mf, "credit_customer"),
        empresa: getMetafield(mf, "company"),
        industria: getMetafield(mf, "industry")
      }
    };
  })
  .filter(Boolean);



  return Response.json({
    sapId,
    total: historial.length,
    historial
  });
};




function extractId(gid: string) {
  return gid.split("/").pop();
}

function getMetafield(
  metafields: any,
  key: string,
  namespace = "custom"
) {
  return metafields?.edges
    ?.find(
      (m: any) =>
        m.node.key === key && m.node.namespace === namespace
    )
    ?.node.value || null;
}
