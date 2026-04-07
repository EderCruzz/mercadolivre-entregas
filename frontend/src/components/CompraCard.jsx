import { useEffect, useState } from "react";
import api from "../services/api";
import noImage from "../assets/no-image.jpg";
import "./CompraCard.css";
import ImageModal from "./ImageModal";
import Trash from "../assets/trash-icon.png";

import EditIcon from "../assets/edit-icon.png";
import EditarPalavraModal from "./EditarPalavraModal";

export default function CompraCard({ compra, view, onAtualizar }) {
  const [centro, setCentro] = useState("");
  const [conferente, setConferente] = useState("");
  const [imagemAberta, setImagemAberta] = useState(false);
  const [palavraChave, setPalavraChave] = useState(compra.palavra_chave || "");
  const [previsaoEntrega, setPrevisaoEntrega] = useState(
    compra.previsao_entrega
      ? compra.previsao_entrega.split("T")[0]
      : ""
  );
  const [modalEditar, setModalEditar] = useState(false);

  // previsão de entrega (date)
  const previsaoEntregaFormatada =
  compra.previsao_entrega &&
    compra.previsao_entrega.split("T")[0]
      .split("-")
      .reverse()
      .join("/");

  const temImagemValida = compra.image && compra.image !== noImage;

  // trava scroll quando modal aberto
  useEffect(() => {
    document.body.style.overflow = imagemAberta ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [imagemAberta]);

  async function salvarTriagem() {
    try {
      // obrigatórios
      if (!centro.trim() || !previsaoEntrega) return;

      await api.put(`/entregas/${compra.pedido_id}/centro-custo`, {
        centro_custo: centro
      });

      await api.put(`/entregas/${compra.pedido_id}/previsao-entrega`, {
        previsao_entrega: previsaoEntrega
      });

      // opcional
      if (palavraChave.trim()) {
        await api.put(`/entregas/${compra.pedido_id}/palavra-chave`, {
          palavra_chave: palavraChave
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

  async function marcarPedidoEmitido() {
    await api.put(`/entregas/${compra.pedido_id}/pedido-emitido`);
    onAtualizar();
  }

  async function cancelarPedido() {
    const confirmar = window.confirm(
      "Tem certeza que deseja mover para Cancelados/Devolvidos?"
    );

    if (!confirmar) return;

    try {
      await api.put(`/entregas/${compra.pedido_id}/cancelar`);
      onAtualizar();
    } catch (err) {
      console.error("Erro ao cancelar:", err);
    }
  }

  async function salvarPalavraChave(novaPalavra) {
    if (!novaPalavra.trim()) return;

    try {
      await api.put(`/entregas/${compra.pedido_id}/palavra-chave`, {
        palavra_chave: novaPalavra
      });

      setModalEditar(false);
      onAtualizar();

    } catch (err) {
      console.error("Erro ao salvar palavra-chave:", err);
    }
  }

  // validações
  const podeSalvarTriagem = !!centro.trim() && !!previsaoEntrega;
  const podeConfirmarRecebimento = !!conferente.trim();

  return (
    <>
      <div className={`compra-card ${view}`}>
        {view !== "cancelados" && (
        <>
          {view === "classificados" && (
              <button
                className="btn-editar"
                onClick={() => setModalEditar(true)}
              >
                <img src={EditIcon} alt="Editar" />
              </button>
            )}

            <button className="btn-cancelar" onClick={cancelarPedido}>
              <img src={Trash} alt="Lixeira" />
            </button>
          </>
        )}
        {/* IMAGEM */}
        <div
          className={`compra-card-image ${temImagemValida ? "clickable" : ""}`}
          onClick={() => temImagemValida && setImagemAberta(true)}
        >
          <img
            src={temImagemValida ? compra.image : noImage}
            alt={compra.produto}
            onError={e => {
              e.target.src = "./no-image.jpg"
            }}
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

          {/* PREVISÃO FIXA */}
          {previsaoEntregaFormatada && view !== "entregues" && (
            <p className="meta">
              Chega em <strong>{previsaoEntregaFormatada}</strong>
            </p>
          )}

          <p className="meta">
            Quantidade: <strong>{compra.quantidade}</strong>
          </p>

          {/* TRIAGEM */}
          {view === "triagem" && (
            <div className="form-row vertical triagem-row">
              <div className="date-wrapper">
                {!previsaoEntrega && (
                  <span className="date-placeholder">Data</span>
                )}

                <input
                  type="date"
                  className="input-data"
                  value={previsaoEntrega}
                  onChange={e => setPrevisaoEntrega(e.target.value)}
                />
              </div>

              <input
                placeholder="Palavra-chave (opcional)"
                className="input-palavra"
                value={palavraChave}
                onChange={e => setPalavraChave(e.target.value)}
              />

              <input
                placeholder="Centro de custo"
                className="input-centro"
                value={centro}
                onChange={e => setCentro(e.target.value)}
              />

              <button
                onClick={salvarTriagem}
                disabled={!podeSalvarTriagem}
              >
                Salvar
              </button>
            </div>
          )}

          {/* CLASSIFICADOS */}
          {view === "classificados" && (
            <>
              <p className="meta">
                Centro de custo: <strong>{compra.centro_custo}</strong>
              </p>

              {compra.palavra_chave && (
                <p className="meta">
                  🔑 Palavra-chave: <strong>{compra.palavra_chave}</strong>
                </p>
              )}

              <div className="form-row">
                <input
                  placeholder="Conferente"
                  value={conferente}
                  onChange={e => setConferente(e.target.value)}
                />
                <button
                  onClick={confirmarRecebimento}
                  disabled={!podeConfirmarRecebimento}
                >
                  Confirmar recebimento
                </button>
              </div>
            </>
          )}

          {/* ENTREGUES */}
          {view === "entregues" && (
            <>
              <p className="meta">
                Centro de custo: <strong>{compra.centro_custo}</strong>
              </p>

              {compra.palavra_chave && (
                <p className="meta">
                  🔑 Palavra-chave: <strong>{compra.palavra_chave}</strong>
                </p>
              )}

              <p className="meta">
                Conferente: <strong>{compra.conferente}</strong>
              </p>

              <p className="meta">
                Recebido em{" "}
                <strong>
                  {new Date(compra.data_recebimento).toLocaleDateString("pt-BR")}{" "}
                  às{" "}
                  {new Date(compra.data_recebimento).toLocaleTimeString(
                    "pt-BR",
                    {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit"
                    }
                  )}
                </strong>
              </p>
              <button
                className="btn-pedido-emitido"
                onClick={marcarPedidoEmitido}
              >
                Pedido emitido
              </button>
            </>
          )}

          {view === "pedidos-emitidos" && (
            <>
              <p className="meta">
                Centro de custo: <strong>{compra.centro_custo}</strong>
              </p>

              <p className="meta">
                Conferente: <strong>{compra.conferente}</strong>
              </p>

              <p className="meta">
                ✅ Pedido administrativo emitido
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
      <EditarPalavraModal
        aberto={modalEditar}
        onClose={() => setModalEditar(false)}
        onSalvar={salvarPalavraChave}
        palavraAtual={compra.palavra_chave}
      />
    </>
  );
}
