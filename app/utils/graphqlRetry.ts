import { createToken } from "app/lib/shopifyToken";
import { setAdminToken } from "app/lib/adminClient";

/*
  Recibe:
  - función graphql
  - referencia al token (closure)
*/
export async function graphqlWithRetry(
  graphqlFn: (q: string, v?: any) => Promise<Response>,
  onTokenUpdate: (t: string) => void,
  query: string,
  variables?: any
) {
  let res = await graphqlFn(query, variables);

  if (res.status === 401 || res.status === 403) {
    console.log(" Token inválido, regenerando...");

    const newToken = await createToken();
    await setAdminToken(newToken);

    onTokenUpdate(newToken);

    res = await graphqlFn(query, variables);
  }

  return res;
}
