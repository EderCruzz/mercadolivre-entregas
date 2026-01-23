import "./Header.css";
import logo from "../assets/cepe-logo.png";

export default function Header({ onSync, syncing }) {
  return (
    <header className="app-header">
      <div className="header-left">
        <img src={logo} alt="CEPE" className="logo" />
      </div>

      <div className="header-right">
        <button
          className="sync-button"
          onClick={onSync}
          disabled={syncing}
        >
          {syncing ? "Sincronizando..." : "Sincronizar"}
        </button>
      </div>
    </header>
  );
}
