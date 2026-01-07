const mongoose = require("mongoose");

const EntregaSchema = new mongoose.Schema(
  {
    pedido_id: Number,
    produto: String,
    status_pedido: String,
    status_entrega: String,
    valor: Number,
    data_compra: Date,
    transportadora: String,
    rastreio: String
  },
  { timestamps: true }
);

module.exports = mongoose.model("Entrega", EntregaSchema);
