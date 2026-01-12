import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const sapId = new URL(request.url).searchParams.get("sapId");

  if (!sapId) {
    return Response.json(
      { error: "Debe enviar sapId" },
      { status: 400 }
    );
  }

  /* 1️⃣ Buscar customers por SAP */
  const customersRes = await admin.graphql(`
    query {
      customers(first: 100, query: "metafield:id_custumer_sap:${sapId}") {
        edges {
          node {
            id
            displayName
          }
        }
      }
    }
  `);

  const customersData = await customersRes.json();
  const customers = customersData.data.customers.edges.map(e => e.node);

  if (!customers.length) {
    return Response.json({ historial: [] });
  }

  /* 2️⃣ Buscar orders de TODOS los customers */
  const filter = customers
    .map(c => `customer_id:${c.id}`)
    .join(" OR ");

  const ordersRes = await admin.graphql(`
    query ($query: String!) {
      orders(first: 100, query: $query, reverse: true) {
        edges {
          node {
            id
            name
            createdAt
            processedAt
            sourceName

            displayFinancialStatus
            fulfillmentStatus

            subtotalPriceSet {
              shopMoney { amount }
            }

            totalShippingPriceSet {
              shopMoney { amount }
            }

            totalTaxSet {
              shopMoney { amount }
            }

            totalPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }

            discountApplications(first: 5) {
              edges {
                node {
                  ... on DiscountApplication {
                    value {
                      ... on MoneyV2 {
                        amount
                      }
                    }
                  }
                }
              }
            }

            lineItems(first: 5) {
              edges {
                node {
                  title
                  quantity
                }
              }
            }

            customer {
              displayName
              email
              phone
              metafields(first: 10) {
                edges {
                  node {
                    key
                    value
                  }
                }
              }
            }

            shippingAddress {
              company
              country
              city
            }
          }
        }
      }
    }
  `, {
    variables: { query: filter }
  });

  const ordersData = await ordersRes.json();

  /* 3️⃣ Formatear salida */
  const historial = ordersData.data.orders.edges.map(e => {
    const o = e.node;

    const sap = o.customer?.metafields.edges
      .find(m => m.node.key === "id_custumer_sap")
      ?.node.value;

    const descuento = o.discountApplications.edges
      .reduce((acc, d) => acc + Number(d.node.value?.amount || 0), 0);

    return {
      numeroOrden: o.name,
      fecha: o.createdAt,
      procesado: o.processedAt,

      cliente: o.customer?.displayName,
      email: o.customer?.email,
      telefono: o.customer?.phone,

      sapId: sap,

      canal: o.sourceName,
      estadoPago: o.displayFinancialStatus,
      estadoEnvio: o.fulfillmentStatus,

      subtotal: Number(o.subtotalPriceSet.shopMoney.amount),
      envio: Number(o.totalShippingPriceSet.shopMoney.amount),
      impuestos: Number(o.totalTaxSet.shopMoney.amount),

      descuento,
      total: Number(o.totalPriceSet.shopMoney.amount),
      moneda: o.totalPriceSet.shopMoney.currencyCode,

      pais: o.shippingAddress?.country,
      ciudad: o.shippingAddress?.city,
      empresaEnvio: o.shippingAddress?.company,

      productos: o.lineItems.edges.map(l => ({
        nombre: l.node.title,
        cantidad: l.node.quantity
      }))
    };
  });

  return Response.json({
    sapId,
    totalRegistros: historial.length,
    historial
  });
};
