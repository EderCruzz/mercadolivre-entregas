import { useEffect, useState } from "react";
import api from "../services/api";
import noImage from "../assets/no-image.jpg";
import "./CompraCard.css";
import ImageModal from "./ImageModal";

export default function CompraCard({ compra, view, onAtualizar }) {
  const [centro, setCentro] = useState("");
  const [conferente, setConferente] = useState("");
  const [imagemAberta, setImagemAberta] = useState(false);

  // 📦 previsão de entrega (date)
  const [previsaoEntrega, setPrevisaoEntrega] = useState(
    compra.previsao_entrega
      ? compra.previsao_entrega.split("T")[0]
      : ""
  );

  const temImagemValida = compra.image && compra.image !== noImage;

  // 🔒 trava scroll quando modal aberto
  useEffect(() => {
    document.body.style.overflow = imagemAberta ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [imagemAberta]);

  async function salvarTriagem() {
    try {
      // salva centro de custo (se existir)
      if (centro.trim()) {
        await api.put(`/entregas/${compra.pedido_id}/centro-custo`, {
          centro_custo: centro
        });
      }

      // salva previsão de entrega (se existir)
      if (previsaoEntrega) {
        await api.put(`/entregas/${compra.pedido_id}/previsao-entrega`, {
          previsao_entrega: previsaoEntrega
        });
      }

      onAtualizar();
    } catch (err) {
      console.error("Erro ao salvar triagem:", err);
    }
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
    <>
      <div className={`compra-card ${view}`}>
        {/* IMAGEM */}
        <div
          className={`compra-card-image ${temImagemValida ? "clickable" : ""}`}
          onClick={() => temImagemValida && setImagemAberta(true)}
        >
          <img
            src={temImagemValida ? compra.image : noImage}
            alt={compra.produto}
          />
        </div>

        {/* INFO */}
        <div className="compra-card-info">
          <h3 className="produto">{compra.produto}</h3>

          <p className="meta">
            Compra em{" "}
            <strong>
              {new Date(compra.data_compra).toLocaleDateString("pt-BR")}
            </strong>
          </p>

          {/* 📦 PREVISÃO FIXA */}
          {previsaoEntregaFormatada && view !== "entregues" && (
            <p className="meta">
              Chega em <strong>{previsaoEntregaFormatada}</strong>
            </p>
          )}

          <p className="meta">
            Quantidade: <strong>{compra.quantidade}</strong>
          </p>

          {/* 🧾 TRIAGEM */}
          {view === "triagem" && (
            <div className="form-row vertical triagem-row">
              <div className="date-wrapper">
                {!previsaoEntrega && <span className="date-placeholder">Data</span>}

                <input
                  type="date"
                  className="input-data"
                  value={previsaoEntrega}
                  onChange={e => setPrevisaoEntrega(e.target.value)}
                />
              </div>

              <input
                placeholder="Centro de custo"
                className="input-centro"
                value={centro}
                onChange={e => setCentro(e.target.value)}
              />

              <button onClick={salvarTriagem}>Salvar</button>
            </div>
          )}

          {/* 📦 CLASSIFICADOS */}
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

          {/* ✅ ENTREGUES */}
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
                  {new Date(compra.data_recebimento).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit"
                  })}
                </strong>
                .
              </p>
            </>
          )}
        </div>

        {/* VENDEDOR */}
        <div className="compra-card-seller">{compra.vendedor}</div>
      </div>

      {/* MODAL GLOBAL */}
      <ImageModal
        image={imagemAberta && temImagemValida ? compra.image : null}
        onClose={() => setImagemAberta(false)}
      />
    </>
  );
}
