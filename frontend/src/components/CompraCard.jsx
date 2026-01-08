import "./CompraCard.css";
import noImage from "../assets/no-image.jpg";

export default function CompraCard({ compra }) {
  const {
    produto,
    image,
    quantidade,
    status_entrega,
    data_compra,
    data_entrega,
    vendedor,
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
        src={image || noImage}
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

        <p>
          Quantidade: <strong>{quantidade}</strong>
        </p>

        {data_entrega && (
          <p>
            Entregue em{" "}
            {new Date(data_entrega).toLocaleDateString("pt-BR")}
          </p>
        )}
      </div>

      <div className="seller">
        {vendedor}
      </div>
    </div>
  );
}
