import "./CompraCard.css";

export default function CompraCard({ compra }) {
  const {
    produto,
    imagem,
    status_entrega,
    data_compra,
    data_entrega,
    vendedor,
    palavra_chave,
  } = compra;

  const statusMap = {
    delivered: { label: "Entregue", class: "green" },
    shipped: { label: "Enviado", class: "blue" },
    ready_to_ship: { label: "Preparando envio", class: "blue" },
  };

  const status = statusMap[status_entrega] || {
    label: "Em preparação",
    class: "gray",
  };

  return (
    <div className="card">
      <img
        src={imagem || "https://via.placeholder.com/90"}
        alt={produto}
        className="product-img"
      />

      <div className="info">
        <span className={`status ${status.class}`}>
          {status.label}
        </span>

        <h3>{produto}</h3>

        <p>
          Compra em{" "}
          {new Date(data_compra).toLocaleDateString("pt-BR")}
        </p>

        {data_entrega && (
          <p>
            Entregue em{" "}
            {new Date(data_entrega).toLocaleDateString("pt-BR")}
          </p>
        )}

        {palavra_chave && (
          <p className="keyword">
            Palavra-chave: <strong>{palavra_chave}</strong>
          </p>
        )}
      </div>

      <div className="seller">
        {vendedor || "Mercado Livre"}
      </div>
    </div>
  );
}
