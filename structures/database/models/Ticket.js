const mongoose = require("mongoose");

const QuoteSchema = new mongoose.Schema({
  user: String,
  messageId: String,
  timeFrame: String,
  price: Number,
  basePrice: Number,
  notes: String,
  declined: Boolean,
});

const QuestionSchema = new mongoose.Schema({
  questionName: String,
  question: String,
  answer: String
});

const ListOfQuestionsSchema = new mongoose.Schema({
  list: [{
    name: String,
    question: String
  }],
  ticketCategory: Object,
  modalArr: Array
});

const CommissionSchema = new mongoose.Schema({
  id: Number,
  user: String,
  commMessageId: String,
  commChannelId: String,
  status: String,
  date: Date,
  quoteList: [QuoteSchema]
});

const TicketDataSchema = new mongoose.Schema({
  owner: String,
  openedAt: Date,
  openedTimestamp: String,
  id: Number,
  category: String,
});

const TicketSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  ticketData: {
    type: TicketDataSchema,
    default: {}
  },
  ticketClaimed: {
    type: String,
    default: ""
  },
  autoClaim: {
    type: String,
    default: ""
  },
  commission: {
    type: CommissionSchema,
  },
  notes: {
    type: String,
    default: ""
  },
  listOfQuestions: {
    type: ListOfQuestionsSchema,
    default: {}
  },
  listOfAnswers: {
    type: [QuestionSchema],
    default: []
  },
  questionPage: {
    type: Number,
    default: 1
  },
  questionsAnswered: {
    type: Boolean,
    default: false
  },
  priority: {
    type: String,
    default: ""
  } 
});

module.exports = mongoose.model("Ticket", TicketSchema);