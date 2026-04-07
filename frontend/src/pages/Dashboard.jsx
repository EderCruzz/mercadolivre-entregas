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

  // troca de aba
  useEffect(() => {
    setSearch("");
    setPage(1);
    carregarCompras(1, "");
  }, [view]);

  // paginação
  useEffect(() => {
    if (!search.trim()) {
      carregarCompras(page);
    }
  }, [page]);

  // busca
  useEffect(() => {
    if (search.trim() !== "") {
      // busca ativa > pega tudo
      carregarCompras(1, search);
    } else {
      // busca limpa > volta paginação normal
      setPage(1);
      carregarCompras(1, "");
    }
  }, [search]);

  async function carregarCompras(pagina, termoBusca = search) {
    let url = `/entregas?view=${view}`;

    if (termoBusca && termoBusca.trim() !== "") {
      url += `&search=${encodeURIComponent(termoBusca)}&all=true`;
    } else {
      url += `&page=${pagina}`;
    }

    try {
      // inicia fade-out
      setAnimating(true);

      // espera animação sair
      await new Promise(resolve => setTimeout(resolve, 200));

      const res = await api.get(url);

      setCompras(res.data.data || []);
      setTotalPages(res.data.totalPages);

      // pequeno delay pra evitar "flash"
      setTimeout(() => {
        setAnimating(false);
      }, 100);

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

  // AGORA SEM FILTRO DE BUSCA AQUI
  const comprasFiltradas = search
    ? compras // usa direto o resultado do backend
    : (compras || []).filter(compra => {
      if (!compra) return false;

      if (view === "cancelados") return compra.cancelado === true;
      if (compra.cancelado) return false;

      if (view === "entregues") {
        return compra.conferente && !compra.pedido_emitido;
      }

      if (view === "pedidos-emitidos") {
        return compra.pedido_emitido === true;
      }

      if (view === "classificados") {
        return compra.centro_custo && !compra.conferente;
      }

      if (view === "triagem") {
        return !compra.centro_custo;
      }

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
          <button className={view === "triagem" ? "active" : ""} onClick={() => setView("triagem")}>
            Triagem
          </button>

          <button className={view === "classificados" ? "active" : ""} onClick={() => setView("classificados")}>
            Classificados
          </button>

          <button className={view === "entregues" ? "active" : ""} onClick={() => setView("entregues")}>
            Recebidos
          </button>

          <button className={view === "pedidos-emitidos" ? "active" : ""} onClick={() => setView("pedidos-emitidos")}>
            Pedidos Emitidos
          </button>

          <button className={view === "cancelados" ? "active" : ""} onClick={() => setView("cancelados")}>
            Cancelados/ Devolvidos
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

        {!search && !animating && totalPages > 1 && compras.length > 0 && (
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