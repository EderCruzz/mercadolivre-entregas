import { useState } from "react";
import api from "../services/api";
import noImage from "../assets/no-image.jpg";
import "./CompraCard.css";

export default function CompraCard({ compra, view, onAtualizar }) {
  const [centro, setCentro] = useState("");
  const [conferente, setConferente] = useState("");

  async function salvarCentroCusto() {
    if (!centro.trim()) return;

    await api.put(`/entregas/${compra.pedido_id}/centro-custo`, {
      centro_custo: centro
    });

    onAtualizar();
  }

  async function confirmarRecebimento() {
    if (!conferente.trim()) return;

    await api.put(`/entregas/${compra._id}/recebimento`, {
      conferente
    });

    onAtualizar();
  }

  // 🔥 STATUS VISUAL
  const statusMap = {
    delivered: { label: "Entregue", className: "status-entregue" },
    shipped: { label: "Enviado", className: "status-enviado" },
    ready_to_ship: { label: "Preparando envio", className: "status-enviado" }
  };

  const status =
    statusMap[compra.status_entrega] ||
    (view === "entregues"
      ? { label: "Entregue", className: "status-entregue" }
      : null);

  return (
    <div className="card">
      <div className="card-image">
        <img
          src={compra.image || noImage}
          alt={compra.produto}
        />
      </div>

      <div className="card-info">
        {/* ✅ STATUS NO TOPO */}
        {status && (
          <span className={`status-badge ${status.className}`}>
            {status.label}
          </span>
        )}

        <h3>{compra.produto}</h3>

        <p>
          Compra em{" "}
          <strong>
            {new Date(compra.data_compra).toLocaleDateString("pt-BR")}
          </strong>
        </p>

        <p>
          Quantidade: <strong>{compra.quantidade}</strong>
        </p>

        {/* 🔹 TRIAGEM */}
        {view === "triagem" && (
          <div className="form-row">
            <input
              placeholder="Centro de custo"
              value={centro}
              onChange={e => setCentro(e.target.value)}
            />
            <button onClick={salvarCentroCusto}>
              Enviar
            </button>
          </div>
        )}

        {/* 🔹 CLASSIFICADOS */}
        {view === "classificados" && (
          <>
            <p>
              Centro de custo: <strong>{compra.centro_custo}</strong>
            </p>

            <div className="form-row">
              <input
                placeholder="Conferente"
                value={conferente}
                onChange={e => setConferente(e.target.value)}
              />
              <button onClick={confirmarRecebimento}>
                Confirmar recebimento
              </button>
            </div>
          </>
        )}

        {/* 🔹 ENTREGUES */}
        {view === "entregues" && (
          <>
            <p>
              Centro de custo: <strong>{compra.centro_custo}</strong>
            </p>
            <p>
              Conferente: <strong>{compra.conferente}</strong>
            </p>
            <p>
              Recebido em{" "}
              <strong>
                {new Date(compra.data_recebimento).toLocaleDateString("pt-BR")}{" "}
                às{" "}
                {new Date(compra.data_recebimento).toLocaleTimeString("pt-BR")}
              </strong>
            </p>
          </>
        )}
      </div>

      <div className="card-seller">
        {compra.vendedor}
      </div>
    </div>
  );
}
