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
      <img src={compra.image || noImage} alt={compra.produto} />

      <div className="info">
        <h3>{compra.produto}</h3>
        <p>Quantidade: {compra.quantidade}</p>

        {view === "triagem" && (
          <>
            <input
              placeholder="Centro de custo"
              value={centro}
              onChange={e => setCentro(e.target.value)}
            />
            <button onClick={salvarCentroCusto}>Enviar</button>
          </>
        )}

        {view === "classificados" && (
          <>
            <p>Centro de custo: <strong>{compra.centro_custo}</strong></p>
            <input
              placeholder="Conferente"
              value={conferente}
              onChange={e => setConferente(e.target.value)}
            />
            <button onClick={confirmarRecebimento}>
              Confirmar recebimento
            </button>
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

      <div className="seller">{compra.vendedor}</div>
    </div>
  );
}
