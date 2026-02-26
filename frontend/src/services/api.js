import axios from "axios";

const api = axios.create({
  baseURL: "https://n8n.cepeenergia.com.br/api/",
});

export default api;
