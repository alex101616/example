import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const query = `
    query GetOrdersWithCustomers(
      $first: Int,
      $sortKey: OrderSortKeys,
      $reverse: Boolean
    ) {
      orders(first: $first, sortKey: $sortKey, reverse: $reverse) {
        edges {
          node {
            id
            name
            createdAt
            totalPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            metafields(first: 20) {
              edges {
                node {
                  namespace
                  key
                  type
                  value
                }
              }
            }
            customer {
              id
              displayName
              email
              phone
              metafields(first: 20) {
                edges {
                  node {
                    namespace
                    key
                    type
                    value
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  const variables = {
    first: 250,
    sortKey: "CREATED_AT",
    reverse: true,
  };

  const response = await admin.graphql(query, { variables });
  const data = await response.json();
  console.log(response);
  return new Response(
    JSON.stringify({ result: data.data }),
    {
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
};
