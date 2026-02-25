import axios from "axios";

const api = axios.create({
  baseURL: "http://72.60.141.173:3333",
});

export default api;
