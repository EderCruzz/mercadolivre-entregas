import { createPortal } from "react-dom";
import "./ImageModal.css";

export default function ImageModal({ image, onClose }) {
  if (!image) return null;

  return createPortal(
    <div className="image-modal">
      <div
        className="image-modal-backdrop"
        onClick={onClose}
      />

      <div className="image-modal-content">
        <button
          className="image-modal-close"
          onClick={onClose}
        >
          ✕
        </button>

        <img src={image} alt="Imagem ampliada" />
      </div>
    </div>,
    document.getElementById("modal-root")
  );
}
