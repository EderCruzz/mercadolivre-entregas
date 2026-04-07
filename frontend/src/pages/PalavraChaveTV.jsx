import { useEffect, useRef, useState } from "react";
import api from "../services/api";
import "./PalavraChaveTV.css";
import logo from "../assets/cepe-logo.png";

export default function PalavraChaveTV() {

  const [compras, setCompras] = useState([]);

  const [isMobile, setIsMobile] = useState(false);

  const scrollRef = useRef(null);

  async function carregar() {

    let page = 1;
    let totalPages = 1;
    let todas = [];

    while (page <= totalPages) {

      const res = await api.get(`/entregas?page=${page}&view=classificados`);

      totalPages = res.data.totalPages;

      todas = [...todas, ...res.data.data];

      page++;
    }

    const filtradas = todas.filter(
      c => c.palavra_chave && c.palavra_chave.trim() !== ""
    );

    setCompras(filtradas);
  }

  useEffect(() => {
    function checkMobile() {
        setIsMobile(window.innerWidth <= 768);
    }

    checkMobile();

    window.addEventListener("resize", checkMobile);

    return () => window.removeEventListener("resize", checkMobile);
    }, []);

  useEffect(() => {

    carregar();

    const interval = setInterval(() => {
      carregar();
    }, 300000); // 5 minutos

    return () => clearInterval(interval);

  }, []);

  useEffect(() => {

    let direction = 1;

    const interval = setInterval(() => {

        if (isMobile) return;

        const el = scrollRef.current;
        if (!el) return;

        const maxScroll = el.scrollHeight - el.clientHeight;

        const chegouNoFim = el.scrollTop >= maxScroll - 5;
        const chegouNoTopo = el.scrollTop <= 0;

        if (chegouNoFim) direction = -1;
        if (chegouNoTopo) direction = 1;

        el.scrollBy(0, direction * 2);

    }, 16);

    return () => clearInterval(interval);

    }, [isMobile]);

    useEffect(()=>{

        const handler = () => {

            if(document.fullscreenElement){
            document.body.classList.add("fullscreen-active")
            }

        }

        document.addEventListener("fullscreenchange",handler)

        return ()=>document.removeEventListener("fullscreenchange",handler)

    },[])

    function entrarFullscreen() {

        const el = document.documentElement;

        if (el.requestFullscreen) el.requestFullscreen();
        else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
        else if (el.msRequestFullscreen) el.msRequestFullscreen();
    }

  return (
    <div className="tv-container">

        <div className="tv-header">
            <img src={logo} alt="CEPE" className="logo" />

            <div className="tv-header-title-button">
                <h1>ENTREGAS COM PALAVRA-CHAVE</h1>
                <button
                    className="tv-fullscreen"
                    onClick={entrarFullscreen}    
                >
                    Tela Cheia
                </button>
            </div>
        </div>

        <div className="tv-scroll" ref={scrollRef}>

        <div className="tv-grid">

            {compras.map(c => (

            <div key={c._id} className="tv-card">

                <div className="tv-img">
                <img src={c.image} alt={c.produto} />
                </div>

                <div className="tv-info">

                <div className="tv-key">
                    {c.palavra_chave}
                </div>

                <div className="tv-product">
                    {c.produto}
                </div>

                <div className="tv-previsao">
                    Previsão de entrega:{" "} 
                    
                    <strong>
                        {
                        c.previsao_entrega &&
                        c.previsao_entrega.split("T")[0]
                        .split("-")
                        .reverse()
                        .join("/")
                        }</strong>
                </div>

                <p className="tv-quantidade">
                    Quantidade: <strong>{c.quantidade}</strong>
                </p>

                <div className="tv-meta">
                    Centro de Custo: {c.centro_custo}
                </div>

                <div className="tv-seller">
                    Vendedor:{" "}
                        <strong>
                            {c.vendedor}
                        </strong>
                </div>

                </div>

            </div>

            ))}

        </div>

        </div>

    </div>
    );
}