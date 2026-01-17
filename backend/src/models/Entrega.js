const mongoose = require("mongoose");

const EntregaSchema = new mongoose.Schema(
  {
    pedido_id: Number,
    produto: String,
    image: String,

    vendedor: String,
    quantidade: String,

    status_pedido: String,
    status_entrega: String,

    data_entrega: Date,
    data_compra: Date,

    valor: Number,
    transportadora: String,
    rastreio: String,

    // 🆕 NOVO CAMPO
    centro_custo: {
      type: String,
      default: null
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Entrega", EntregaSchema);
