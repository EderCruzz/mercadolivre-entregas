import "./Header.css";
import logo from "../assets/cepe-logo.png"; // ou svg

export default function Header() {
  return (
    <header className="app-header">
      <div className="header-content">
        <div className="header-left">
          <img src={logo} alt="CEPE Energia" className="logo" />
        </div>
      </div>
    </header>
  );
}
