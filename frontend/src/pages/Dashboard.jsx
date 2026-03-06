import { useEffect, useState } from "react";
import api from "../services/api";
import CompraCard from "../components/CompraCard";
import Header from "../components/Header";
import "../App.css";

export default function Dashboard() {

  const [compras, setCompras] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [view, setView] = useState("triagem");
  const [animating, setAnimating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setSearch("");
    setPage(1);
    carregarCompras(1);
  }, [view]);

  useEffect(() => {
    carregarCompras(page);
  }, [page]);

  async function carregarCompras(pagina) {
    const url = `/entregas?page=${pagina}&view=${view}`;

    try {
      setAnimating(true);

      setTimeout(async () => {
        const res = await api.get(url);

        setCompras(res.data.data);
        setTotalPages(res.data.totalPages);

        setTimeout(() => {
          setAnimating(false);
        }, 300);
      }, 200);

    } catch (err) {
      console.error("Erro ao carregar compras:", err);
      setAnimating(false);
    }
  }

  async function sincronizarEntregas() {
    try {
      setSyncing(true);

      await api.get("/entregas/sync");

      await carregarCompras(1);
      setPage(1);

    } catch (err) {
      console.error("Erro ao sincronizar entregas:", err);
    } finally {
      setSyncing(false);
    }
  }

  const comprasFiltradas = compras
    .filter(compra =>
      compra.produto
        .toLowerCase()
        .includes(search.toLowerCase())
    )
    .filter(compra => {
      if (view === "pedidos-emitidos") return compra.pedido_emitido === true;
      if (view === "entregues") return compra.conferente && !compra.pedido_emitido;
      return true;
    });

  return (
    <>
      <Header
        onSync={sincronizarEntregas}
        syncing={syncing}
      />

      <div className="container">
        <h1 className="page-title">COMPRAS E-COMMERCE</h1>

        <div className="tabs">
          <button
            className={view === "triagem" ? "active" : ""}
            onClick={() => setView("triagem")}
          >
            Triagem
          </button>

          <button
            className={view === "classificados" ? "active" : ""}
            onClick={() => setView("classificados")}
          >
            Classificados
          </button>

          <button
            className={view === "entregues" ? "active" : ""}
            onClick={() => setView("entregues")}
          >
            Recebidos
          </button>

          <button
            className={view === "pedidos-emitidos" ? "active" : ""}
            onClick={() => setView("pedidos-emitidos")}
          >
            Pedidos Emitidos
          </button>
        </div>

        <div className="search">
          <input
            type="text"
            placeholder="Pesquisar produto..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className={`cards-wrapper ${animating ? "fade-out" : "fade-in"}`}>
          {comprasFiltradas.map(compra => (
            <CompraCard
              key={compra.pedido_id}
              compra={compra}
              view={view}
              onAtualizar={() => carregarCompras(page)}
            />
          ))}
        </div>

        {!animating && totalPages > 1 && compras.length > 0 && (
          <div className="pagination">
            <button
              onClick={() => setPage(p => Math.max(p - 1, 1))}
              disabled={page === 1}
            >
              Anterior
            </button>

            <span>
              Página {page} de {totalPages}
            </span>

            <button
              onClick={() => setPage(p => Math.min(p + 1, totalPages))}
              disabled={page === totalPages}
            >
              Próxima
            </button>
          </div>
        )}
      </div>
    </>
  );
}