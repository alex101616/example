import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

/* ================= GET ================= */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const questions = await getQuestions(admin);

  return new Response(JSON.stringify({ questions }), {
    headers: { "Content-Type": "application/json" }
  });
};

/* ================= POST | DELETE ================= */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const method = request.method;
  const body = await request.json();

  /* ===== CREATE / UPDATE ===== */
  if (method === "POST") {

    const questions = body.questions; // ✅ arreglo completo

    if (!Array.isArray(questions)) {
      return new Response(
        JSON.stringify({ error: "Formato inválido" }),
        { status: 400 }
      );
    }

    return saveQuestions(admin, questions);
  }

  /* ===== DELETE ===== */
  if (method === "DELETE") {

    const id = body.id;

    const current = await getQuestions(admin);
    const filtered = current.filter((q:any) => q.id !== id);

    return saveQuestions(admin, filtered);
  }

  return new Response(
    JSON.stringify({ error: "Método no soportado" }),
    { status: 405 }
  );
};

/* ================= HELPERS ================= */

async function getShopId(admin:any) {
  const query = `
    query {
      shop { id }
    }
  `;

  const res = await admin.graphql(query);
  const json = await res.json();

  return json.data.shop.id;
}

async function getQuestions(admin:any) {

  const query = `
    query {
      shop {
        metafield(namespace:"surveys", key:"questions") {
          value
        }
      }
    }
  `;

  const res = await admin.graphql(query);
  const json = await res.json();

  return json.data.shop.metafield
    ? JSON.parse(json.data.shop.metafield.value)
    : [];
}

async function saveQuestions(admin:any, questions:any[]) {

  const shopId = await getShopId(admin);

  const mutation = `
    mutation SaveSurvey($value: String!, $ownerId: ID!) {
      metafieldsSet(metafields: [{
        namespace: "surveys",
        key: "questions",
        type: "json",
        value: $value,
        ownerId: $ownerId
      }]) {
        metafields { id }
        userErrors { field message }
      }
    }
  `;

  const variables = {
    value: JSON.stringify(questions),
    ownerId: shopId
  };

  const res = await admin.graphql(mutation, { variables });
  const json = await res.json();

  return new Response(JSON.stringify({
    ok: true,
    result: json.data.metafieldsSet
  }), {
    headers: { "Content-Type": "application/json" }
  });
}
