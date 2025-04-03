const mongoose = require("mongoose");

const TranscriptSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true    
  },
  code: {
    type: String,
    required: true
  },
  owner: {
    type: String,
    required: false
  },
  date: {
    type: Date,
    required: false
  }
});

module.exports = mongoose.model("Transcript", TranscriptSchema);