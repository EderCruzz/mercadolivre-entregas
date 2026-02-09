const mongoose = require("mongoose");

const EntregaSchema = new mongoose.Schema(
  {
    pedido_id: {
      type: Number,
      required: true,
    },
    produto: String,
    image: String,

    vendedor: String,
    quantidade: String,

    status_pedido: String,
    status_entrega: String,
    previsao_entrega: Date,

    data_entrega: Date,
    data_compra: Date,

    valor: Number,
    transportadora: String,
    rastreio: String,

    centro_custo: {
      type: String,
      default: null
    },
    palavra_chave: {
      type: String,
      default: null
    },
    pedido_emitido: {
      type: Boolean,
      default: false
    },
    conferente: String,  
    data_recebimento: Date, 
  },
  { timestamps: true }
);

module.exports = mongoose.model("Entrega", EntregaSchema);
