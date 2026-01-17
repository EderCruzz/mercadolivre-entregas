import { useState } from "react";
import api from "../services/api";
import "./CompraCard.css";
import noImage from "../assets/no-image.jpg";

export default function CompraCard({ compra, view, onAtualizar }) {
  const {
    produto,
    image,
    quantidade,
    status_entrega,
    data_compra,
    data_entrega,
    vendedor,
    centro_custo,
    pedido_id
  } = compra;

  const [centro, setCentro] = useState("");

  const statusMap = {
    delivered: { label: "Entregue", class: "green" },
    shipped: { label: "Enviado", class: "blue" },
    ready_to_ship: { label: "Preparando envio", class: "blue" },
  };

  const status = statusMap[status_entrega] || {
    label: "Em preparação",
    class: "gray",
  };

  async function salvarCentroCusto() {
    if (!centro.trim()) return;

    try {
      await api.put(`/entregas/${pedido_id}/centro-custo`, {
        centro_custo: centro
      });

      onAtualizar(); // 🔄 recarrega lista
    } catch (err) {
      console.error("Erro ao salvar centro de custo", err);
    }
  }

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

        {/* 🔥 RENDER CONDICIONAL (AQUI) */}
        {view === "pendente" && (
          <div className="centro-custo-form">
            <label>Centro de custo:</label>
            <input
              type="text"
              value={centro}
              onChange={e => setCentro(e.target.value)}
              placeholder="Ex: OBRA, ESTOQUE, ESCRITÓRIO"
            />
            <button onClick={salvarCentroCusto}>
              Enviar
            </button>
          </div>
        )}

        {view === "definido" && (
          <p>
            Centro de custo: <strong>{centro_custo}</strong>
          </p>
        )}

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
