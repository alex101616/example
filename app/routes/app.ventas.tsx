import { useState, useEffect } from "react";


export default function VentasPage() {



  const [expanded, setExpanded] = useState(null);
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
    const nombreCompany = sapNombreField?.node.value || "Sin nombre";

    if (!map[sapId]) {
      map[sapId] = {
        empresa: nombreCompany,
        total: 0,
        orders: [], // 👈 clave
      };
    }

    map[sapId].total += total;

    // 👇 guardas info de la orden
    map[sapId].orders.push({
      id: node.id,
      name: node.name,
      total,
      cliente: node.customer?.displayName || "Sin cliente",
      fecha: node.createdAt,
      metodoPago: node.paymentGatewayNames?.join(", ") || "N/A"
    });
  });

  setRows(Object.values(map));
};

const formatFecha = (fecha) => {
  return new Date(fecha).toLocaleDateString("es-CL");
};

  return (
    <>
    

     <style>
      {`
        #table-row-dropdown {
          cursor: pointer;
        }

     
      `}
    </style>
    



      <s-page heading="Reporte de Ventas por Empresa" />

      <s-section padding="none">
        <s-table id="ventas-empresa-table">
          <s-table-header-row>
            <s-table-header>Empresa (SAP ID)</s-table-header>
            <s-table-header>Total Ventas</s-table-header>
          </s-table-header-row>

   <s-table-body>
  {rows.map((row, index) => {
    const isOpen = expanded === index;

    return (
      <>
        {/* FILA PRINCIPAL */}
        <s-table-row
        id="table-row-dropdown"
          key={index}
          onClick={() => setExpanded(isOpen ? null : index)}
          style={{ cursor: "pointer" }}
        >
          <s-table-cell>
            {isOpen ? "▼" : "▶"} {row.empresa}
          </s-table-cell>
          <s-table-cell>
            {row.total.toFixed(2)}
          </s-table-cell>
        </s-table-row>

        {/* FILA EXPANDIBLE */}
        <s-table-row id="table-row" key={`${index}-details`}>
          <s-table-cell colSpan={2} style={{ padding: 0 }}>
            <div
              style={{
                maxHeight: isOpen ? "500px" : "0px",
                overflow: "hidden",
                transition: "max-height 0.35s ease",
                background: "#f6f6f7",
              }}
            >
              <div style={{ padding: "12px" }}>
                
                {/* 👇 TABLA INTERNA */}
                <s-table>
                  <s-table-header-row>
                    <s-table-header>Orden</s-table-header>
                    <s-table-header>Cliente</s-table-header>
                    <s-table-header>Total</s-table-header>
                    <s-table-header>Fecha</s-table-header>
                    <s-table-header>Método de Pago</s-table-header>

                  </s-table-header-row>

                  <s-table-body>
                    {row.orders.map((order) => (
                      <s-table-row key={order.id}>
                        <s-table-cell id="cell-table-dropdown">{order.name}</s-table-cell>
                        <s-table-cell id="cell-table-dropdown">{order.cliente}</s-table-cell>
                        <s-table-cell id="cell-table-dropdown">
                          ${order.total.toFixed(2)}
                        </s-table-cell>
                        <s-table-cell>{formatFecha(order.fecha)}</s-table-cell>
                        <s-table-cell>{order.metodoPago}</s-table-cell>
                        
                      </s-table-row>
                    ))}
                  </s-table-body>
                </s-table>

              </div>
            </div>
          </s-table-cell>
        </s-table-row>
      </>
    );
  })}
</s-table-body>
        </s-table>
      </s-section>
    </>
  );
}
