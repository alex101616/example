import { useState, useEffect } from "react";


export default function VentasPage() {



  const [rows, setRows] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      const res = await fetch("/api/ventas", {
        method: "GET",
      });

      const json = await res.json();
     // const orders = json.result.data.orders.edges;
      const orders = json.result.orders.edges;

      processOrders(orders);
    };

    fetchData();
  }, []);

  const processOrders = (orders) => {
    const map = {};

    orders.forEach(({ node }) => {
      const total = parseFloat(node.totalPriceSet.shopMoney.amount);

      const sapField = node.customer?.metafields.edges.find(
        (m) => m.node.key === "id_customer_sap"
      );

       const sapNombreField = node.customer?.metafields.edges.find(
        (m) => m.node.key === "company"
      );

      if (!sapField) return;

      const sapId = sapField.node.value;

      const nombreCompany = sapNombreField.node.value;

      if (!map[sapId]) {
        map[sapId] = {
          empresa: nombreCompany,
          total: 0,
        };
      }

      map[sapId].total += total;
    });

    setRows(Object.values(map));
  };

  return (
    <>
      <s-page heading="Reporte de Ventas por Empresa" />

      <s-section padding="none">
        <s-table>
          <s-table-header-row>
            <s-table-header>Empresa (SAP ID)</s-table-header>
            <s-table-header>Total Ventas</s-table-header>
          </s-table-header-row>

          <s-table-body>
            {rows.map((row, index) => (
              <s-table-row key={index}>
                <s-table-cell>{row.empresa}</s-table-cell>
                <s-table-cell>{row.total.toFixed(2)}</s-table-cell>

              </s-table-row>
            ))}
          </s-table-body>
        </s-table>
      </s-section>
    </>
  );
}
