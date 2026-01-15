import { useEffect, useState } from "react";
import api from "./services/api";
import CompraCard from "./components/CompraCard";
import "./App.css";

function App() {
  const [compras, setCompras] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    carregarCompras(page);
  }, [page]);

  async function carregarCompras(pagina) {
    try {
      setAnimating(true);

      // ⏳ espera a animação de saída
      setTimeout(async () => {
        setLoading(true);

        const res = await api.get(`/entregas?page=${pagina}`);

        setCompras(res.data.data);
        setTotalPages(res.data.totalPages);

        setLoading(false);

        // ⏳ animação de entrada
        setTimeout(() => {
          setAnimating(false);
        }, 50);

      }, 200);

    } catch (err) {
      console.error("Erro ao carregar compras:", err);
      setAnimating(false);
    }
  }

  return (
    <div className="container">
      <h1>📦 Minhas Compras</h1>

      <div className={`cards-wrapper ${animating ? "fade-out" : "fade-in"}`}>
        {compras.map(compra => (
          <CompraCard
            key={compra.pedido_id}
            compra={compra}
          />
        ))}
      </div>

      {/* PAGINAÇÃO */}
      <div className="pagination">
        <button
          onClick={() => setPage(p => Math.max(p - 1, 1))}
          disabled={page === 1}
        >
          ⬅ Anterior
        </button>

        <span>
          Página {page} de {totalPages}
        </span>

        <button
          onClick={() => setPage(p => Math.min(p + 1, totalPages))}
          disabled={page === totalPages}
        >
          Próxima ➡
        </button>
      </div>
    </div>
  );
}

export default App;
