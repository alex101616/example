import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  /* ===== FORMAT FECHA ===== */
  const formatFecha = (iso: string) => {
    const date = new Date(iso);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  /* ===== LABEL TIPO ===== */
  const labelTipo = (type: string) => {
    if (type === "rating") return "Estrellas";
    if (type === "single_choice") return "Opción única";
    if (type === "text") return "Texto libre";
    return type || "";
  };

  /* ===== 1. TRAER TODAS LAS ÓRDENES (PAGINADO) ===== */
  let allOrders: any[] = [];
  let hasNextPage = true;
  let cursor: string | null = null;

  while (hasNextPage) {
    const res = await admin.graphql(
      `
      query ($cursor: String) {
        orders(
          first: 100,
          after: $cursor,
          sortKey: CREATED_AT,
          reverse: true,
          query: "metafield:custom.survey_answers:*"
        ) {
          edges {
            node {
              name
              createdAt
              metafield(namespace: "custom", key: "survey_answers") {
                value
              }
              customer {
                displayName
                email
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
      `,
      {
        variables: { cursor }
      }
    );

    const json = await res.json();
    const data = json.data.orders;

    allOrders.push(...data.edges);

    hasNextPage = data.pageInfo.hasNextPage;
    cursor = data.pageInfo.endCursor;
  }

  const orders = allOrders;

  /* ===== 2. TRAER PREGUNTAS ===== */
  const questionsRes = await admin.graphql(`
    query {
      shop {
        metafield(namespace: "surveys", key: "questions") {
          value
        }
      }
    }
  `);

  const questionsJson = await questionsRes.json();

  let questions: any[] = [];

  try {
    questions = questionsJson?.data?.shop?.metafield?.value
      ? JSON.parse(questionsJson.data.shop.metafield.value)
      : [];
  } catch (e) {
    console.error("Error parseando preguntas", e);
  }

  /* ===== 3. MAP ID → TEXTO + TIPO ===== */
  const questionMap: Record<string, { text: string; type: string }> = {};

  questions.forEach((q: any) => {
    questionMap[q.id] = {
      text: q.text,
      type: q.type,
    };
  });

  /* ===== 4. PROCESAR RESPUESTAS ===== */
  let rows: any[] = [];

  orders.forEach(({ node }: any) => {
    if (!node.metafield?.value) return;

    let answers: any[] = [];

    try {
      answers = JSON.parse(node.metafield.value);
    } catch (e) {
      console.error("Error parseando respuestas", e);
      return;
    }

    answers.forEach((a: any) => {
      const q = questionMap[a.questionId];

      rows.push({
        orden: node.name,
        cliente: node.customer?.displayName || "",
        email: node.customer?.email || "",
        fecha: formatFecha(node.createdAt),
        pregunta: q?.text || a.questionId,
        tipo: labelTipo(q?.type),
        respuesta: a.value || "",
      });
    });
  });

  /* ===== 5. ESCAPE CSV ===== */
  const escapeCSV = (value: any) => {
    const str = String(value ?? "");
    return `"${str.replace(/"/g, '""')}"`;
  };

  /* ===== 6. GENERAR CSV ===== */
  const headers = [
    "Orden",
    "Cliente",
    "Email",
    "Fecha",
    "Pregunta",
    "Tipo",
    "Respuesta"
  ];

  const csvContent = [
    headers.join(";"),
    ...rows.map(r =>
      [
        escapeCSV(r.orden),
        escapeCSV(r.cliente),
        escapeCSV(r.email),
        escapeCSV(r.fecha),
        escapeCSV(r.pregunta),
        escapeCSV(r.tipo),
        escapeCSV(r.respuesta)
      ].join(";")
    )
  ].join("\n");

  const csv = "\uFEFF" + csvContent;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=encuestas.csv"
    }
  });
};