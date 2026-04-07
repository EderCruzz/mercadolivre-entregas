import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import "./EditarPalavraModal.css";

export default function EditarPalavraModal({
  aberto,
  onClose,
  onSalvar,
  palavraAtual
}) {
  const [valor, setValor] = useState("");

  useEffect(() => {
    if (aberto) {
      setValor(palavraAtual || "");
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [aberto, palavraAtual]);

  if (!aberto) return null;

  return createPortal(
    <div className="modal-overlay">
      <div className="modal-box">
        <h3>Editar palavra-chave</h3>

        <input
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder="Digite a palavra-chave"
        />

        <div className="modal-actions">
          <button onClick={onClose}>
            Cancelar
          </button>

          <button onClick={() => onSalvar(valor)}>
            Salvar
          </button>
        </div>
      </div>
    </div>,
    document.body 
  );
}