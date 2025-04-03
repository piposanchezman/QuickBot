const mongoose = require("mongoose");
const chalk = require("chalk");
const MongoData = require("./MongoData");
const User = require("./models/User");
const Ticket = require("./models/Ticket");
const Suggestion = require("./models/Suggestion");
const Guild = require("./models/Guild");
const Transcript = require("./models/Transcript");
const Invoice = require("./models/Invoice");

module.exports = class MongoDatabase {
  database;
  constructor(client) {
    this.client = client;

    this.initDatabase();
  }

  initDatabase() {
    mongoose.connect(this.client.config.general.database.mongo.uri, {
      useNewUrlParser: true,
    }).then(() => {
      console.log(chalk.green("[DATABASE] ") + "Connection to MongoDB established.");
    })
    .catch((err) => {
      console.log(chalk.red("[DATABASE] ") + "Connection to MongoDB couldn't be established, check error below.");
      console.log(err)
    });
  }

  usersData() {
    return new MongoData(this.client, User);
  }

  ticketsData() {
    return new MongoData(this.client, Ticket);
  }

  suggestionsData() {
    return new MongoData(this.client, Suggestion);
  }

  transcriptsData() {
    return new MongoData(this.client, Transcript);
  }

  invoicesData() {
    return new MongoData(this.client, Invoice);
  }

  guildData() {
    return new MongoData(this.client, Guild);
  }
}
