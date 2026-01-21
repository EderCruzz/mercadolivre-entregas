import { useState } from "react";
import api from "../services/api";
import noImage from "../assets/no-image.jpg";
import "./CompraCard.css";

export default function CompraCard({ compra, view, onAtualizar }) {
  const [centro, setCentro] = useState("");
  const [conferente, setConferente] = useState("");
  const [previsaoManual, setPrevisaoManual] = useState("");

  async function salvarTriagem() {
    // salva previsão de entrega (se existir)
    if (!compra.previsao_entrega && previsaoManual) {
      await api.put(
        `/entregas/${compra.pedido_id}/previsao-entrega`,
        { previsao_entrega: previsaoManual }
      );
    }

    // salva centro de custo (se existir)
    if (centro.trim()) {
      await api.put(`/entregas/${compra.pedido_id}/centro-custo`, {
        centro_custo: centro
      });
    }

    setPrevisaoManual("");
    setCentro("");
    onAtualizar();
  }

  async function confirmarRecebimento() {
    if (!conferente.trim()) return;

    await api.put(`/entregas/${compra.pedido_id}/recebimento`, {
      conferente
    });

    setConferente("");
    onAtualizar();
  }

  const previsaoEntregaFormatada =
    compra.previsao_entrega &&
    new Date(compra.previsao_entrega).toLocaleDateString("pt-BR");

  return (
    <div className={`compra-card ${view}`}>
      {/* IMAGEM */}
      <div className="compra-card-image">
        <img src={compra.image || noImage} alt={compra.produto} />
      </div>

      {/* INFORMAÇÕES */}
      <div className="compra-card-info">
        <h3 className="produto">{compra.produto}</h3>

        <p className="meta">
          Compra em{" "}
          <strong>
            {new Date(compra.data_compra).toLocaleDateString("pt-BR")}
          </strong>
        </p>

        {/* PREVISÃO EXISTENTE */}
        {previsaoEntregaFormatada && (
          <p className="meta">
            Chega em <strong>{previsaoEntregaFormatada}</strong>
          </p>
        )}

        <p className="meta">
          Quantidade: <strong>{compra.quantidade}</strong>
        </p>

        {view === "triagem" && (
          <div className="form-column">
            {/* PREVISÃO MANUAL */}
            {!compra.previsao_entrega && (
              <input
                type="date"
                value={previsaoManual}
                onChange={e => setPrevisaoManual(e.target.value)}
              />
            )}

            {/* CENTRO DE CUSTO */}
            <input
              placeholder="Centro de custo"
              value={centro}
              onChange={e => setCentro(e.target.value)}
            />

            {/* BOTÃO ÚNICO */}
            <button onClick={salvarTriagem}>
              Salvar
            </button>
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
      </div>

      {/* VENDEDOR */}
      <div className="compra-card-seller">
        {compra.vendedor}
      </div>
    </div>
  );
}
