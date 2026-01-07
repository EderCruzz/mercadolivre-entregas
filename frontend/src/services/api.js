import axios from "axios";

export const api = axios.create({
  baseURL: "https://mercadolivre-entregas.onrender.com"
});
