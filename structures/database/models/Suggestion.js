const mongoose = require("mongoose");

const VotersSchema = new mongoose.Schema({
  user: String,
  type: String
});

const SuggestionSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true    
  },
  text: String,
  date: String,
  decision: String,
  author: {
    username: String,
    avatar: String
  },
  yes: Number,
  no: Number,
  voters: {
    type: [VotersSchema]
  },
  status: String,
});

module.exports = mongoose.model("Suggestion", SuggestionSchema);