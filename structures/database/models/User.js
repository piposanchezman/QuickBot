const mongoose = require("mongoose");

const ReviewsSchema = new mongoose.Schema({
  id: String,
  author: String,
  user: String,
  rating: Number,
  comment: String,
  date: Date
});

const ClientProfileSchema = new mongoose.Schema({
  amountSpent: {
    type: Number,
    default: 0,
  },
  orderCount: {
    type: Number,
    default: 0
  }
});

const TicketsSchema = new mongoose.Schema({
  member: String,
  channel: String,
  reason: String,
  parent: String,
  ticketCategory: String
});

const UserSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  reviews: {
    type: [ReviewsSchema],
    default: []
  },
  tickets: {
    type: [TicketsSchema],
    default: []
  },
  clientProfile: {
    type: ClientProfileSchema,
  },
  balance: {
    type: Number,
    default: 0
  },
  paypal: {
    type: String,
    default: ""
  },
  availableHours: {
    type: String,
    default: ""
  },
  portfolio: {
    type: String,
    default: ""
  },
  bio: {
    type: String,
    default: ""
  },
  recentResponse: {
    type: [Number],
    default: []
  },
  totalResponse: {
    type: [String],
    default: []
  },
  choosingCategory: {
    type: Boolean,
    default: false
  },
  claimedStats: {
    type: Number,
    default: 0
  },  
});

module.exports = mongoose.model("User", UserSchema);