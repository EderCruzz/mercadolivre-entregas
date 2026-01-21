import { useEffect, useState } from "react";
import api from "../services/api";
import noImage from "../assets/no-image.jpg";
import "./CompraCard.css";

export default function CompraCard({ compra, view, onAtualizar }) {
  const [centro, setCentro] = useState("");
  const [conferente, setConferente] = useState("");
  const [imagemAberta, setImagemAberta] = useState(false);

  const temImagemValida =
    compra.image && compra.image !== noImage;

  // 🔒 trava o scroll do body quando modal estiver aberto
  useEffect(() => {
    if (imagemAberta) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [imagemAberta]);

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
          onClick={() => {
            if (temImagemValida) setImagemAberta(true);
          }}
        >
          <img
            src={temImagemValida ? compra.image : noImage}
            alt={compra.produto}
          />
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

          {previsaoEntregaFormatada && view !== "entregues" && (
            <p className="meta">
              Chega em <strong>{previsaoEntregaFormatada}</strong>
            </p>
          )}

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
                  {new Date(compra.data_recebimento).toLocaleDateString("pt-BR")}
                </strong>
              </p>
            </>
          )}
        </div>

        {/* VENDEDOR */}
        <div className="compra-card-seller">{compra.vendedor}</div>
      </div>

      {/* 🔍 MODAL DE IMAGEM — SOMENTE SE EXISTIR IMAGEM */}
      {imagemAberta && temImagemValida && (
        <div className="image-modal">
          {/* FUNDO ESCURO — CLIQUE FECHA */}
          <div
            className="image-modal-backdrop"
            onClick={() => setImagemAberta(false)}
          />

          {/* IMAGEM */}
          <div className="image-modal-content">
            <button
              className="image-modal-close"
              onClick={() => setImagemAberta(false)}
            >
              ✕
            </button>

            <img src={compra.image} alt={compra.produto} />
          </div>
        </div>
      )}
    </>
  );
}
