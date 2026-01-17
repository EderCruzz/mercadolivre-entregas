import { useState } from "react";
import api from "../services/api";
import noImage from "../assets/no-image.jpg";
import "./CompraCard.css";

export default function CompraCard({ compra, view, onAtualizar }) {
  const [centro, setCentro] = useState("");
  const [conferente, setConferente] = useState("");

  async function salvarCentroCusto() {
    if (!centro.trim()) return;

    await api.put(`/entregas/${compra._id}/centro-custo`, {
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

  return (
  <div className="card">
    <div className="card-image">
      <img
        src={compra.image || noImage}
        alt={compra.produto}
      />
    </div>

    <div className="card-info">
      <h3>{compra.produto}</h3>

      <p>Quantidade: <strong>{compra.quantidade}</strong></p>

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

      {view === "entregues" && (
        <>
          <p>Centro de custo: <strong>{compra.centro_custo}</strong></p>
          <p>Conferente: <strong>{compra.conferente}</strong></p>
          <p>
            Data:{" "}
            {new Date(compra.data_recebimento).toLocaleDateString("pt-BR")}
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
