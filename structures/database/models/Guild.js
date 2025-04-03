const mongoose = require("mongoose");

const CountersSchema = new mongoose.Schema({
  openedChannel: {
    type: String,
    default: ""
  },
  totalChannel: {
    type: String,
    default: ""
  },
  claimedChannel: {
    type: String,
    default: ""
  }
});

const WithdrawRequestsSchema = new mongoose.Schema({
  id: String,
  user: String,
  amount: Number,
  mail: String
})

const GuildSchema = new mongoose.Schema({
  id: {
    type: String,
  },
  withdrawRequests: {
    type: [WithdrawRequestsSchema],
    default: []
  },
  suggestionDecisions: {
    type: [{
      id: String,
      decision: String
    }],
    default: []
  },
  ticketCount: {
    type: Number,
    default: 0
  },
  commissionCount: {
    type: Number,
    default: 0
  },
  sellixVerified: {
    type: Array,
    default: []
  },
  tebexVerified: {
    type: Array,
    default: []
  },
  craftingVerified: {
    type: Array,
    default: []
  },
  claimedTickets: {
    type: Number,
    default: 0
  },
  counters: CountersSchema,
  totalInvoices: {
    type: Number,
    default: 0
  },
  totalIncome: {
    type: Number,
    default: 0
  },
  todayStats: {
    type: Array,
    default: []
  },
  weekStats: {
    type: Array,
    default: []
  },
  serverLogs: {
    type: Array,
    default: []
  },
  dashboardLogs: {
    type: Array,
    default: []
  }
});

module.exports = mongoose.model("Guild", GuildSchema);