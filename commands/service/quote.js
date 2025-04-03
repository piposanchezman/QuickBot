const Command = require("../../structures/Command");
const Discord = require("discord.js");

module.exports = class Quote extends Command {
  constructor(client) {
    super(client, {
      name: "quote",
      description: client.cmdConfig.quote.description,
      usage: client.cmdConfig.quote.usage,
      permissions: client.cmdConfig.quote.permissions,
      aliases: client.cmdConfig.quote.aliases,
      category: "service",
      enabled: client.cmdConfig.quote.enabled,
      slash: true,
    });
  }

  async run(message, args) {
    let price = args[0];
    let timeFrame = args[1];
    let notes = args.slice(2).join(' ');

    const channelData = await this.client.database.ticketsData().get(`${message.channel.id}`) || {};
    let commission = channelData.commission;
    if(!commission || commission?.status != "NO_STATUS") return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.service.commission.not_commission, this.client.embeds.error_color)] });
    if(!price) return message.channel.send({ embeds: [this.client.utils.usage(this.client, message, this.client.cmdConfig.quote.usage)] });

    let chAnswers = channelData.listOfAnswers || [];
    if(chAnswers.length == 0) message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.service.commission.no_data, this.client.embeds.error_color)] });

    const taxPrice = this.client.utils.priceWithTax(this.client, Number(price));

    const userData = await this.client.database.usersData().get(message.author.id) || {};

    let embed = new Discord.EmbedBuilder()
      .setColor(this.client.embeds.service.quote.color);
    if(this.client.embeds.service.quote.title) embed.setTitle(this.client.embeds.service.quote.title);

    let history = userData.reviews?.filter((r) => r.rating) || [];
    let bio = userData.bio || "N/A";
    let availableHours = userData.availableHours || "N/A";
    let portfolio = userData.portfolio || "N/A";

    let totalRating = 0;
    for(let i = 0; i < history.length; i++) {
      totalRating += parseInt(history[i].rating);
    }
    
    totalRating = Math.floor(totalRating/history.length);
    
    if(this.client.embeds.service.quote.description) embed.setDescription(this.client.embeds.service.quote.description.replace("<price>", price)
      .replace("<priceWithTax>", taxPrice)
      .replace("<user>", message.author.username)
      .replace("<userId>", message.author.id)
      .replace("<bio>", bio)
      .replace("<portfolio>", portfolio)
      .replace("<availableHours>", availableHours)
      .replace("<client>", `<@!${commission.user}>`)
      .replace("<currency>", this.client.config.general.currency)
      .replace("<currencySymbol>", this.client.config.general.currency_symbol)
      .replace("<timeFrame>", timeFrame || this.client.language.service.commission.no_time_frame)
      .replace("<notes>", notes || this.client.language.service.commission.no_notes)
      .replace("<rating>", this.client.config.emojis.review.star.repeat(totalRating)));
    
    let field = this.client.embeds.service.quote.fields;
    for(let i = 0; i < this.client.embeds.service.quote.fields.length; i++) {
      embed.addFields([{ name: field[i].title.replace("<currency>", this.client.config.general.currency), value: field[i].description.replace("<price>", price)
        .replace("<priceWithTax>", taxPrice)
        .replace("<user>", message.author.username)
        .replace("<userId>", message.author.id)
        .replace("<bio>", bio)
        .replace("<portfolio>", portfolio)
        .replace("<availableHours>", availableHours)
        .replace("<client>", `<@!${commission.user}>`)
        .replace("<currency>", this.client.config.general.currency)
        .replace("<currencySymbol>", this.client.config.general.currency_symbol)
        .replace("<timeFrame>", timeFrame || this.client.language.service.commission.no_time_frame)
        .replace("<notes>", notes || this.client.language.service.commission.no_notes)
        .replace("<rating>", this.client.config.emojis.review.star.repeat(totalRating)), inline: this.client.embeds.service.quote.inline }])
    }
    
    if(this.client.embeds.service.quote.footer == true ) embed.setFooter({ text: message.author.username, iconURL: message.author.displayAvatarURL() }).setTimestamp();
    if(this.client.embeds.service.quote.thumbnail == true) embed.setThumbnail(user.displayAvatarURL());
      
    let bttnRow = new Discord.ActionRowBuilder().addComponents(
      new Discord.ButtonBuilder()
        .setLabel(this.client.language.buttons.quote)
        .setStyle(Discord.ButtonStyle.Success)
        .setEmoji(this.client.config.emojis.quote || {})
        .setCustomId("accept_quote")
    );

    if(this.client.config.general.buttons.decline_quote == true)
      bttnRow.addComponents(
        new Discord.ButtonBuilder()
          .setLabel(this.client.language.buttons.decline_quote)
          .setStyle(Discord.ButtonStyle.Danger)
          .setEmoji(this.client.config.emojis.decline_quote || {})
          .setCustomId("decline_quote")
      );

    message.channel.send({ content: `<@!${commission.user}>`, embeds: [embed], components: [bttnRow] }).then(async(msg) => {
      commission.quoteList.push({
        user: message.author.id,
        messageId: msg.id,
        timeFrame,
        price: taxPrice,
        basePrice: price,
        notes,
        declined: false
      });

      await this.client.database.ticketsData().set(`${message.channel.id}.commission`, commission);
      
      setTimeout(() => message.delete().catch((err) => {}), 1000);
    });
  }
  
  async slashRun(interaction, args) {
    const channelData = await this.client.database.ticketsData().get(`${interaction.channel.id}`) || {};
    let commission = channelData.commission;
    if(!commission || commission?.status != "NO_STATUS") return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.commission.not_commission, this.client.embeds.error_color)], flags: this.client.cmdConfig.quote.ephemeral ? Discord.MessageFlags.Ephemeral : 0 });

    let chAnswers = channelData.listOfAnswers || [];
    if(chAnswers.length == 0) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.commission.no_data, this.client.embeds.error_color)], flags: this.client.cmdConfig.quote.ephemeral ? Discord.MessageFlags.Ephemeral : 0 });

    let commPrice = new Discord.ActionRowBuilder()
      .addComponents(
        new Discord.TextInputBuilder()
        .setCustomId("commission_price")
        .setLabel(this.client.language.modals.labels.comm_price)
        .setPlaceholder(this.client.language.modals.placeholders.comm_price)
        .setMinLength(1)
        .setRequired(true)
        .setStyle(Discord.TextInputStyle.Short)
      );
    
    let commTime = new Discord.ActionRowBuilder()
      .addComponents(
        new Discord.TextInputBuilder()
        .setCustomId("commission_time")
        .setLabel(this.client.language.modals.labels.comm_time)
        .setPlaceholder(this.client.language.modals.placeholders.comm_time)
        .setMinLength(1)
        .setRequired(true)
        .setStyle(Discord.TextInputStyle.Short)
      );
    
    let commNote = new Discord.ActionRowBuilder()
      .addComponents(
        new Discord.TextInputBuilder()
        .setCustomId("commission_note")
        .setLabel(this.client.language.modals.labels.comm_note)
        .setPlaceholder(this.client.language.modals.placeholders.comm_note)
        .setStyle(Discord.TextInputStyle.Paragraph)
      );

    let commissionModal = new Discord.ModalBuilder()
      .setTitle(this.client.language.titles.quote)
      .setCustomId("commission_modal")
      .addComponents([commPrice, commTime, commNote]);

    interaction.showModal(commissionModal);

    const filter = (i) => i.customId == 'commission_modal' && i.user.id == interaction.user.id;
    interaction.awaitModalSubmit({ filter, time: 120_000 }).then(async(md) => {
      const price = md.fields.getTextInputValue("commission_price");
      const timeFrame = md.fields.getTextInputValue("commission_time");
      const notes = md.fields.getTextInputValue("commission_note");

      const taxPrice = this.client.utils.priceWithTax(this.client, Number(price));

      let commission = await this.client.database.ticketsData().get(`${interaction.channel.id}.commission`);
      if(!commission || commission?.status != "NO_STATUS") return md.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.commission.not_commission, this.client.embeds.error_color)], flags: this.client.cmdConfig.quote.ephemeral ? Discord.MessageFlags.Ephemeral : 0 });

      const userData = await this.client.database.usersData().get(interaction.user.id) || {};

      let embed = new Discord.EmbedBuilder()
        .setColor(this.client.embeds.service.quote.color);
      if(this.client.embeds.service.quote.title) embed.setTitle(this.client.embeds.service.quote.title);

      let history = userData.reviews?.filter((r) => r.rating) || [];
      let bio = userData.bio || "N/A";
      let availableHours = userData.availableHours || "N/A";
      let portfolio = userData.portfolio || "N/A";

      let totalRating = 0;
      for(let i = 0; i < history.length; i++) {
        totalRating += parseInt(history[i].rating);
      }

      totalRating = Math.floor(totalRating/history.length);

      if(this.client.embeds.service.quote.description) embed.setDescription(this.client.embeds.service.quote.description.replace("<price>", price)
        .replace("<priceWithTax>", taxPrice)
        .replace("<user>", interaction.user.username)
        .replace("<userId>", interaction.user.id)
        .replace("<bio>", bio)
        .replace("<portfolio>", portfolio)
        .replace("<availableHours>", availableHours)
        .replace("<currency>", this.client.config.general.currency)
        .replace("<currencySymbol>", this.client.config.general.currency_symbol)
        .replace("<timeFrame>", timeFrame || this.client.language.service.commission.no_time_frame)
        .replace("<notes>", notes || this.client.language.service.commission.no_notes)
        .replace("<rating>", this.client.config.emojis.review.star.repeat(totalRating)));

      let field = this.client.embeds.service.quote.fields;
      for(let i = 0; i < this.client.embeds.service.quote.fields.length; i++) {
        embed.addFields([{ name: field[i].title.replace("<currency>", this.client.config.general.currency), value: field[i].description.replace("<price>", price)
          .replace("<priceWithTax>", taxPrice)
          .replace("<user>", interaction.user.username)
          .replace("<userId>", interaction.user.id)
          .replace("<bio>", bio)
          .replace("<portfolio>", portfolio)
          .replace("<availableHours>", availableHours)
          .replace("<currency>", this.client.config.general.currency)
          .replace("<currencySymbol>", this.client.config.general.currency_symbol)
          .replace("<timeFrame>", timeFrame || this.client.language.service.commission.no_time_frame)
          .replace("<notes>", notes || this.client.language.service.commission.no_notes)
          .replace("<rating>", this.client.config.emojis.review.star.repeat(totalRating)), inline: this.client.embeds.service.quote.inline }])
      }

      if(this.client.embeds.service.quote.footer == true ) embed.setFooter({ text: interaction.user.username, iconURL: interaction.user.displayAvatarURL() }).setTimestamp();
      if(this.client.embeds.service.quote.thumbnail == true) embed.setThumbnail(user.displayAvatarURL());
        
      let bttnRow = new Discord.ActionRowBuilder().addComponents(
        new Discord.ButtonBuilder()
          .setLabel(this.client.language.buttons.quote)
          .setStyle(Discord.ButtonStyle.Success)
          .setEmoji(this.client.config.emojis.quote || {})
          .setCustomId("accept_quote")
        );
            
      if(this.client.config.general.buttons.decline_quote == true)
        bttnRow.addComponents(
          new Discord.ButtonBuilder()
            .setLabel(this.client.language.buttons.decline_quote)
            .setStyle(Discord.ButtonStyle.Danger)
            .setEmoji(this.client.config.emojis.decline_quote || {})
            .setCustomId("decline_quote")
        );

      await md.reply({ content: `<@!${commission.user}>`, embeds: [embed], components: [bttnRow], fetchReply: true }).then(async(msg) => {
        commission.quoteList.push({
          user: interaction.user.id,
          messageId: msg.id,
          price: taxPrice,
          basePrice: price,
          timeFrame,
          notes,
          declined: false
        });

        await this.client.database.ticketsData().set(`${interaction.channel.id}.commission`, commission);
      });
    });
  }
};
