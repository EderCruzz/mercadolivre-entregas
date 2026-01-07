import { useEffect, useState } from 'react';
import api from './services/api';

function App() {
  const [entregas, setEntregas] = useState([]);

  useEffect(() => {
    api.get('/entregas')
      .then(response => setEntregas(response.data))
      .catch(() => alert('Backend não conectado'));
  }, []);

  return (
    <div className="container mt-4">
      <h3>Status de Entregas</h3>

      <table className="table table-striped table-bordered mt-3">
        <thead className="table-dark">
          <tr>
            <th>Item</th>
            <th>Status</th>
            <th>Previsão</th>
            <th>Palavra-chave</th>
            <th>Rastreio</th>
          </tr>
        </thead>
        <tbody>
          {entregas.map(entrega => (
            <tr key={entrega.id}>
              <td>{entrega.item}</td>
              <td>{entrega.status}</td>
              <td>{entrega.previsao}</td>
              <td>{entrega.palavraChave}</td>
              <td>{entrega.rastreio}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default App;
