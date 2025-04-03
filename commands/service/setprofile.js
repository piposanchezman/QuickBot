const Command = require("../../structures/Command");
const Discord = require("discord.js");

module.exports = class SetProfile extends Command {
  constructor(client) {
    super(client, {
      name: "setprofile",
      description: client.cmdConfig.setprofile.description,
      usage: client.cmdConfig.setprofile.usage,
      permissions: client.cmdConfig.setprofile.permissions,
      aliases: client.cmdConfig.setprofile.aliases,
      category: "service",
      enabled: client.cmdConfig.setprofile.enabled,
      slash: true,
    });
  }

  async run(message, args) {
    const userData = await this.client.database.usersData().get(message.author.id) || {};

    let option = args[0];
    if(!option) return message.channel.send({ embeds: [this.client.utils.usage(this.client, message, this.client.cmdConfig.setprofile.usage)] });
    let value = args.slice(1).join(" ");

    if(option.toLowerCase() == "hours") {
      let hours = userData.availableHours
      if(args[1]) {
        await this.client.database.usersData().set(`${message.author.id}.availableHours`, value);
        message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.service.hours_added.replace("<hours>", value), this.client.embeds.success_color)] });
      } else {
        if(!hours || hours == null) return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.general.not_set, this.client.embeds.error_color)] });
        await this.client.database.usersData().delete(`${message.author.id}.availableHours`);
        message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.service.hours_reseted, this.client.embeds.success_color)] });
      }
    } else if(option.toLowerCase() == "paypal") {
      let paypal = userData.paypal;
      if(args[1]) {
        if(!value.includes("@")) return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.language.titles.error, this.client.language.service.invalid_mail, this.client.embeds.error_color )] });
        await this.client.database.usersData().set(`${message.author.id}.paypal`, value);
        message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.service.paypal_added.replace("<paypal>", value), this.client.embeds.success_color)] });
      } else {
        if(!paypal || paypal == null) return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.general.not_set, this.client.embeds.error_color)] });
        await this.client.database.usersData().delete(`${message.author.id}.paypal`);
        message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.service.paypal_reseted, this.client.embeds.success_color)] });
      }
    } else if(option.toLowerCase() == "bio") {
      let bio = userData.bio
      if(args[1]) {
        if(value.length >= this.client.config.general.bio_limit) value = value.slice(0, Number(this.client.config.general.bio_limit - 3)) + '...';
        await this.client.database.usersData().set(`${message.author.id}.bio`, value);
        message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.service.bio_added.replace("<bio>", value), this.client.embeds.success_color)] });
      } else {
        if(!bio || bio == null) return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.general.not_set, this.client.embeds.error_color)] });
        await this.client.database.usersData().delete(`${message.author.id}.bio`);
        message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.service.bio_reseted, this.client.embeds.success_color)] });
      }
    } else if(option.toLowerCase() == "portfolio") {
      let portfolio = userData.portfolio
      if(args[1]) {
        if(/(https?:\/\/)?([^\s]+)?[^\s]+\.[^\s]+/.test(value) == false || value.length >= this.client.config.general.portfolio_limit)
          return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.service.invalid_portfolio, this.client.embeds.error_color)] });
          await this.client.database.usersData().set(`${message.author.id}.portfolio`);
        message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.service.portfolio_added.replace("<portfolio>", value), this.client.embeds.success_color)] });
      } else {
        if(!portfolio || portfolio == null) return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.general.not_set, this.client.embeds.error_color)] });
        await this.client.database.usersData().delete(`${message.author.id}.portfolio`);
        message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.service.portfolio_reseted, this.client.embeds.success_color)] });
      }
    } else {
      message.channel.send({ embeds: [this.client.utils.usage(this.client, message, this.client.cmdConfig.setprofile.usage)] }); 
    }
  }
  async slashRun(interaction, args) {
    const userData = await this.client.database.usersData().get(interaction.user.id) || {};
    let defaultBio = userData.bio || "";
    let defaultPayPal = userData.paypal || "";
    let defaultHours = userData.availableHours || "";
    let defaultPortfolio = userData.portfolio || "";
    
    let hoursRow = new Discord.ActionRowBuilder()
      .addComponents(
        new Discord.TextInputBuilder()
          .setLabel(this.client.language.modals.labels.hours)
          .setMaxLength(64)
          .setRequired(false)
          .setValue(defaultHours)
          .setStyle(Discord.TextInputStyle.Short)
          .setCustomId("profile_hours")
          .setPlaceholder(this.client.language.modals.placeholders.hours));
    let paypalRow = new Discord.ActionRowBuilder()
      .addComponents(
        new Discord.TextInputBuilder()
          .setLabel(this.client.language.modals.labels.paypal)
          .setValue(defaultPayPal)
          .setStyle(Discord.TextInputStyle.Short)
          .setMaxLength(64)
          .setRequired(false)
          .setCustomId("profile_paypal")
          .setPlaceholder(this.client.language.modals.placeholders.paypal));
    let bioRow = new Discord.ActionRowBuilder()
      .addComponents(
        new Discord.TextInputBuilder()
          .setLabel(this.client.language.modals.labels.bio)
          .setValue(defaultBio)
          .setRequired(false)
          .setStyle(Discord.TextInputStyle.Paragraph)
          .setMaxLength(this.client.config.general.bio_limit)
          .setCustomId("profile_bio")
          .setPlaceholder(this.client.language.modals.placeholders.bio));
    let portfolioRow = new Discord.ActionRowBuilder()
      .addComponents(
        new Discord.TextInputBuilder()
          .setLabel(this.client.language.modals.labels.portfolio)
          .setValue(defaultPortfolio)
          .setRequired(false)
          .setStyle(Discord.TextInputStyle.Short)
          .setMaxLength(this.client.config.general.portfolio_limit)
          .setCustomId("profile_portfolio")
          .setPlaceholder(this.client.language.modals.placeholders.portfolio));

    let modal = new Discord.ModalBuilder().setTitle(this.client.language.titles.setprofile)
      .setCustomId("setprofile_modal")
      .addComponents([paypalRow, hoursRow, bioRow, portfolioRow]);
      
    interaction.showModal(modal);
      
    let filter = (int) => int.customId == "setprofile_modal" && int.user.id == interaction.user.id;
    interaction.awaitModalSubmit({ filter, time: 120_000 }).then(async(int) => {
      let hourValue = int.fields.getTextInputValue("profile_hours");
      let paypalValue = int.fields.getTextInputValue("profile_paypal");
      let bioValue = int.fields.getTextInputValue("profile_bio");
      let portfolioValue = int.fields.getTextInputValue("profile_portfolio");
      
      if(hourValue.length > 2) {
        await this.client.database.usersData().set(`${interaction.user.id}.availableHours`, hourValue);
      } else {
        await this.client.database.usersData().delete(`${interaction.user.id}.availableHours`);
      }
      
      if(paypalValue.length > 8 && paypalValue.includes("@")) {
        await this.client.database.usersData().set(`${interaction.user.id}.paypal`, paypalValue);
      } else if(paypalValue.length < 8 || !paypalValue.includes("@")) {
        await this.client.database.usersData().delete(`${interaction.user.id}.paypal`);
      }
      
      if(bioValue.length > 8) {
        await this.client.database.usersData().set(`${interaction.user.id}.bio`, bioValue);
      } else {
        await this.client.database.usersData().delete(`${interaction.user.id}.bio`);
      }
      
      if(portfolioValue.length > 4 && /(https?:\/\/)?([^\s]+)?[^\s]+\.[^\s]+/.test(portfolioValue) == true) {
        await this.client.database.usersData().set(`${interaction.user.id}.portfolio`, portfolioValue);
      } else {
        await this.client.database.usersData().delete(`${interaction.user.id}.portfolio`);
      }
      
      int.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.profile_updated, this.client.embeds.success_color)], flags: this.client.cmdConfig.setprofile.ephemeral ? Discord.MessageFlags.Ephemeral : 0 });
    }).catch((err) => {
      console.log(err);
    });
  }
};
