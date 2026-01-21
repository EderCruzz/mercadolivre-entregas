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

    await api.put(`/entregas/${compra.pedido_id}/recebimento`, {
      conferente
    });

    setConferente(""); // opcional, UX melhor
    onAtualizar();
  }

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
    <div className={`compra-card ${view}`}>
      {/* IMAGEM */}
      <div className="compra-card-image">
        <img src={compra.image || noImage} alt={compra.produto} />
      </div>

      {/* INFORMAÇÕES */}
      <div className="compra-card-info">
        {status && (
          <span className={`status-badge ${status.className}`}>
            {status.label}
          </span>
        )}

        <h3 className="produto">{compra.produto}</h3>

        <p className="meta">
          Compra em{" "}
          <strong>
            {new Date(compra.data_compra).toLocaleDateString("pt-BR")}
          </strong>
        </p>

        <p className="meta">
          Quantidade: <strong>{compra.quantidade}</strong>
        </p>

        {view === "triagem" && (
          <div className="form-row">
            <input
              placeholder="Centro de custo"
              value={centro}
              onChange={e => setCentro(e.target.value)}
            />
            <button onClick={salvarCentroCusto}>Salvar</button>
          </div>
        )}

        {view === "classificados" && (
          <>
            <p className="meta">
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

        {view === "entregues" && (
          <>
            <p className="meta">
              Centro de custo: <strong>{compra.centro_custo}</strong>
            </p>
            <p className="meta">
              Conferente: <strong>{compra.conferente}</strong>
            </p>
            <p className="meta">
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

      {/* VENDEDOR */}
      <div className="compra-card-seller">
        {compra.vendedor}
      </div>
    </div>
  );
}
