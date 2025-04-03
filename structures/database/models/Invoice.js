const mongoose = require("mongoose");

const InvoiceSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true    
  },
  guild: String,
  author: String,
  user: String,
  amount: Number,
  amountWithTax: Number,
  service: String,
  date: String
});

module.exports = mongoose.model("Invoice", InvoiceSchema);