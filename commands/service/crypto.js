const Command = require("../../structures/Command");
const { EmbedBuilder, ApplicationCommandOptionType } = require("discord.js");
const cryptoData = require("../../data/crypto.json");
const fetch = require("node-fetch");

module.exports = class Crypto extends Command {
  constructor(client) {
    super(client, {
      name: "crypto",
      description: client.cmdConfig.crypto.description,
      usage: client.cmdConfig.crypto.usage,
      permissions: client.cmdConfig.crypto.permissions,
      aliases: client.cmdConfig.crypto.aliases,
      category: "service",
      enabled: client.cmdConfig.crypto.enabled,
      slash: true,
      options: [{
        name: 'user',
        type: ApplicationCommandOptionType.User,
        description: "User who to pay",
        required: true,
      },{
        name: 'crypto',
        type: ApplicationCommandOptionType.String,
        description: "Crypto to receive (full name)",
        required: true,
      },{
        name: 'address',
        type: ApplicationCommandOptionType.String,
        description: "Address to send Money to",
        required: true,
      },{
        name: 'amount',
        type: ApplicationCommandOptionType.Number,
        description: "Amount of Money in USD",
        required: true,
      },{
        name: 'service',
        type: ApplicationCommandOptionType.String,
        description: "Service User's paying for",
        required: true,
      }]
    });
  }

  async run(message, args) {
    let config = this.client.config;

    let user = message.mentions.users.first() || this.client.users.cache.get(args[0]);
    let cryptoName = args[1];
    let address = args[2];
    let amount = args[3];
    let service = args.slice(4).join(" ");

    if(!user || !cryptoName || !address || !amount || !service) return message.channel.send({ embeds: [this.client.utils.usage(this.client, message, this.client.cmdConfig.crypto.usage)] });
    
    let fullCrypto = "";
    let cryptoAmount;
    let convertedData;
    
    if(Object.values(cryptoData).map(x => x.toLowerCase()).includes(cryptoName.toLowerCase())) {
      fullCrypto = cryptoName;
      let cryptoIndex = Object.values(cryptoData).map(x => x.toLowerCase()).indexOf(cryptoName.toLowerCase());
      cryptoName = Object.keys(cryptoData)[cryptoIndex];

      let convertToCrypto = await fetch(`https://api.coinconvert.net/convert/${this.client.config.general.currency.toLowerCase()}/${cryptoName.toLowerCase()}?amount=${amount}`, {
        method: "GET"
      });

      convertedData = await convertToCrypto.json();
      cryptoAmount = Object.values(convertedData)[2];
    } else if(Object.keys(cryptoData).includes(cryptoName.toUpperCase())) {
      let convertToCrypto = await fetch(`https://api.coinconvert.net/convert/${this.client.config.general.currency.toLowerCase()}/${cryptoName.toLowerCase()}?amount=${amount}`, {
        method: "GET"
      });

      convertedData = await convertToCrypto.json();

      let cryptoIndex = Object.keys(cryptoData).indexOf(cryptoName.toUpperCase());
      cryptoName = Object.values(cryptoData)[cryptoIndex];

      fullCrypto = cryptoName;
      cryptoAmount = Object.values(convertedData)[2];
    } else {
      message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.language.titles.error, this.client.language.service.invalid_crypto, this.client.embeds.error_color)] });
      return;
    }

    let link = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${fullCrypto.toLowerCase()}:${address}?amount=${cryptoAmount}`;

    let embed = new EmbedBuilder()
      .setImage(link)
      .setColor(this.client.embeds.service.crypto.color);
    if(this.client.embeds.service.crypto.title) embed.setTitle(this.client.embeds.service.crypto.title);
    
    if(this.client.embeds.service.crypto.description) embed.setDescription(this.client.embeds.service.crypto.description.replace("<amount>", amount)
      .replace("<seller>", message.author.username)
      .replace("<user>", user.username)
      .replace("<sellerId>", message.author.id)
      .replace("<userId>", user.id)
      .replace("<address>", address)
      .replace("<currency>", this.client.config.general.currency)
      .replace("<currencySymbol>", this.client.config.general.currency_symbol)
      .replace("<symbol>", Object.keys(convertedData)[2])
      .replace("<cryptoAmount>", Object.values(convertedData)[2])
      .replace("<service>", service));
    
    let field = this.client.embeds.service.crypto.fields;
    for(let i = 0; i < this.client.embeds.service.crypto.fields.length; i++) {
      embed.addFields([{ name: field[i].title.replace("<symbol>", Object.keys(convertedData)[2])
        .replace("<currency>", this.client.config.general.currency), value: field[i].description.replace("<amount>", amount)
        .replace("<seller>", message.author.username)
        .replace("<user>", user.username)
        .replace("<sellerId>", message.author.id)
        .replace("<userId>", user.id)
        .replace("<address>", address)
        .replace("<currency>", this.client.config.general.currency)
        .replace("<currencySymbol>", this.client.config.general.currency_symbol)
        .replace("<symbol>", Object.keys(convertedData)[2])
        .replace("<cryptoAmount>", Object.values(convertedData)[2])
        .replace("<service>", service), inline: this.client.embeds.service.crypto.inline }])
    }
    
    if(this.client.embeds.service.crypto.footer == true ) embed.setFooter({ text: message.author.username, iconURL: message.author.displayAvatarURL() }).setTimestamp();
    if(this.client.embeds.service.crypto.thumbnail == true) embed.setThumbnail(user.displayAvatarURL());
      
    message.channel.send({ embeds: [embed] });
  }
  async slashRun(interaction, args) {
    let user = interaction.options.getUser("user");
    let cryptoName = interaction.options.getString("crypto");
    let address = interaction.options.getString("address");
    let amount = interaction.options.getNumber("amount");
    let service = interaction.options.getString("service");

    let fullCrypto = "";
    let cryptoAmount;
    
    let convertedData;
    
    if(Object.values(cryptoData).map(x => x.toLowerCase()).includes(cryptoName.toLowerCase())) {
      fullCrypto = cryptoName;
      let cryptoIndex = Object.values(cryptoData).map(x => x.toLowerCase()).indexOf(cryptoName.toLowerCase());
      cryptoName = Object.keys(cryptoData)[cryptoIndex];

      let convertToCrypto = await fetch(`https://api.coinconvert.net/convert/${this.client.config.general.currency.toLowerCase()}/${cryptoName.toLowerCase()}?amount=${amount}`, {
        method: "GET"
      });

      convertedData = await convertToCrypto.json();
      cryptoAmount = Object.values(convertedData)[2];
    } else if(Object.keys(cryptoData).includes(cryptoName.toUpperCase())) {
      let convertToCrypto = await fetch(`https://api.coinconvert.net/convert/${this.client.config.general.currency.toLowerCase()}/${cryptoName.toLowerCase()}?amount=${amount}`, {
        method: "GET"
      });

      convertedData = await convertToCrypto.json();

      let cryptoIndex = Object.keys(cryptoData).indexOf(cryptoName.toUpperCase());
      cryptoName = Object.values(cryptoData)[cryptoIndex];

      fullCrypto = cryptoName;
      cryptoAmount = Object.values(convertedData)[2];
    } else {
      interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.language.titles.error, this.client.language.service.invalid_crypto, this.client.embeds.error_color)] });
      return;
    }

    let link = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${fullCrypto.toLowerCase()}:${address}?amount=${cryptoAmount}`;

    let embed = new EmbedBuilder()
      .setImage(link)
      .setColor(this.client.embeds.service.crypto.color);
    if(this.client.embeds.service.crypto.title) embed.setTitle(this.client.embeds.service.crypto.title);
    
    if(this.client.embeds.service.crypto.description) embed.setDescription(this.client.embeds.service.crypto.description.replace("<amount>", amount)
      .replace("<seller>", interaction.user.username)
      .replace("<user>", user.username)
      .replace("<sellerId>", interaction.user.id)
      .replace("<userId>", user.id)
      .replace("<address>", address)
      .replace("<currency>", this.client.config.general.currency)
      .replace("<currencySymbol>", this.client.config.general.currency_symbol)
      .replace("<symbol>", Object.keys(convertedData)[2])
      .replace("<cryptoAmount>", Object.values(convertedData)[2])
      .replace("<service>", service));
    
    let field = this.client.embeds.service.crypto.fields;
    for(let i = 0; i < this.client.embeds.service.crypto.fields.length; i++) {
      embed.addFields([{ name: field[i].title.replace("<symbol>", Object.keys(convertedData)[2])
        .replace("<currency>", this.client.config.general.currency), value: field[i].description.replace("<amount>", amount)
        .replace("<seller>", interaction.user.username)
        .replace("<user>", user.username)
        .replace("<sellerId>", interaction.user.id)
        .replace("<userId>", user.id)
        .replace("<currency>", this.client.config.general.currency)
        .replace("<currencySymbol>", this.client.config.general.currency_symbol)
        .replace("<address>", address)
        .replace("<symbol>", Object.keys(convertedData)[2])
        .replace("<cryptoAmount>", Object.values(convertedData)[2])
        .replace("<service>", service), inline: this.client.embeds.service.crypto.inline }])
    }
    
    if(this.client.embeds.service.crypto.footer == true ) embed.setFooter({ text: interaction.user.username, iconURL: interaction.user.displayAvatarURL() }).setTimestamp();
    if(this.client.embeds.service.crypto.thumbnail == true) embed.setThumbnail(user.displayAvatarURL());
      
    interaction.reply({ embeds: [embed] });
  }
};