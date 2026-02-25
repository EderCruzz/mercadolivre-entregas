import axios from "axios";

const api = axios.create({
  baseURL: "https://mercadolivre-entregas.onrender.com",
});

export default api;
