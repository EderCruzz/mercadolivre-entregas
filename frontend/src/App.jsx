import { useEffect, useState } from "react";
import api from "./services/api";
import CompraCard from "./components/CompraCard";
import "./App.css";

function App() {
  const [compras, setCompras] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function carregarCompras() {
      setLoading(true);

      try {
        const res = await api.get(`/public/entregas?page=${page}`);

        setCompras(res.data.data);        // 👈 AQUI ESTAVA O PROBLEMA ANTES
        setTotalPages(res.data.totalPages);
      } catch (err) {
        console.error("Erro ao buscar entregas:", err);
      } finally {
        setLoading(false);
      }
    }

    carregarCompras();
  }, [page]);

  return (
    <div className="container">
      <h1>📦 Minhas Compras</h1>

      {loading && <p>Carregando...</p>}

      {!loading && compras.map(compra => (
        <CompraCard
          key={compra._id}
          compra={compra}
        />
      ))}

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
