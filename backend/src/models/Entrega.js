const mongoose = require("mongoose");

const EntregaSchema = new mongoose.Schema(
  {
    pedido_id: { type: Number, unique: true },
    produto: String,
    status_pedido: String,
    status_entrega: String,
    data_entrega: Date,
    data_compra: Date,
    valor: Number,
    imagem: String,
    transportadora: String,
    rastreio: String
  },
  { timestamps: true }
);

module.exports = mongoose.model("Entrega", EntregaSchema);
