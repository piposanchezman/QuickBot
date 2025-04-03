const Command = require("../../structures/Command");
const Discord = require("discord.js");

module.exports = class Withdraw extends Command {
  constructor(client) {
    super(client, {
      name: "withdraw",
      description: client.cmdConfig.withdraw.description,
      usage: client.cmdConfig.withdraw.usage,
      permissions: client.cmdConfig.withdraw.permissions,
      aliases: client.cmdConfig.withdraw.aliases,
      category: "service",
      enabled: client.cmdConfig.withdraw.enabled,
      slash: true,
      options: [{
        name: "amount",
        description: "Amount to request to withdraw",
        type: Discord.ApplicationCommandOptionType.Number,
        required: true
      }]
    });
  }

  async run(message, args) {
    let amount = args[0];
    if(!amount || isNaN(amount)) return message.channel.send({ embeds: [this.client.utils.usage(this.client, message, this.client.cmdConfig.withdraw.usage)] }); 
    const balance = await this.client.database.usersData().get(`${message.author.id}.balance`) || 0;
    const mail = await this.client.database.usersData().get(`${message.author.id}.paypal`);

    if(amount > balance || balance < 1 || amount < 1) return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.service.invalid_amount, this.client.embeds.error_color)] });
    if(!mail) return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.service.no_mail, this.client.embeds.error_color)] });

    let channel = this.client.utils.findChannel(message.guild, this.client.config.channels.withdraw);

    let withdrawMenu = new Discord.EmbedBuilder()
      .setColor(this.client.embeds.service.withdraw.color);
    
    if(this.client.embeds.service.withdraw.title) withdrawMenu.setTitle(this.client.embeds.service.withdraw.title);
    let field = this.client.embeds.service.withdraw.fields;
    for(let i = 0; i < this.client.embeds.service.withdraw.fields.length; i++) {
      withdrawMenu.addFields([{ name: field[i].title.replace("<currency>", this.client.config.general.currency), value: field[i].description.replace("<user>", message.author)
      .replace("<amount>", amount)
      .replace("<currency>", this.client.config.general.currency)
      .replace("<currencySymbol>", this.client.config.general.currency_symbol)
      .replace("<mail>", mail)
      .replace("<balance>", Number(balance).toFixed(0)), inline: this.client.embeds.service.withdraw.inline }])
    }
    
    if(this.client.embeds.service.withdraw.footer == true) withdrawMenu.setFooter({ text: message.author.username, iconURL: message.author.displayAvatarURL({ dynamic: true }) }).setTimestamp();
    if(this.client.embeds.service.withdraw.thumbnail == true) withdrawMenu.setThumbnail(message.author.displayAvatarURL());
    
    if(this.client.embeds.service.withdraw.description) withdrawMenu.setDescription(this.client.embeds.service.withdraw.description.replace("<user>", message.author)
      .replace("<amount>", amount)
      .replace("<currency>", this.client.config.general.currency)
      .replace("<currencySymbol>", this.client.config.general.currency_symbol)
      .replace("<mail>", mail)
      .replace("<balance>", Number(balance).toFixed(0)));

    let withdrawRow = new Discord.ActionRowBuilder().addComponents(
      new Discord.ButtonBuilder()
        .setLabel(this.client.language.buttons.withdraw_yes)
        .setEmoji(this.client.config.emojis.yes_emoji || {})
        .setCustomId(`withdraw_yes_${amount}`)
        .setStyle(Discord.ButtonStyle.Primary),
      new Discord.ButtonBuilder()
        .setLabel(this.client.language.buttons.withdraw_no)
        .setEmoji(this.client.config.emojis.no_emoji || {})
        .setCustomId(`withdraw_no_${amount}`)
        .setStyle(Discord.ButtonStyle.Danger)
    );

    if(channel) {
      let msg = await channel.send({ embeds: [withdrawMenu], components: [withdrawRow] });
      await this.client.database.guildData().push(`${this.client.config.general.guild}.withdrawRequests`, {
        id: msg.id,
        user: message.author.id,
        amount,
        mail,
      });

      await this.client.database.usersData().sub(`${message.author.id}.balance`, amount);

      message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.service.withdraw_request.replace("<user>", message.author.username).replace("<amount>", amount).replace("<balance>", Number(balance).toFixed(0)), this.client.embeds.success_color)] });
    } else {
      message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.service.no_withdraw_channel, this.client.embeds.error_color)] });
    }
  }
  async slashRun(interaction, args) {
    let amount = interaction.options.getNumber("amount");
    const balance = await this.client.database.usersData().get(`${interaction.user.id}.balance`) || 0;
    const mail = await this.client.database.usersData().get(`${interaction.user.id}.paypal`);
    
    if(amount > balance || balance < 1 || amount < 1) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.invalid_amount, this.client.embeds.error_color)], flags: this.client.cmdConfig.withdraw.ephemeral ? Discord.MessageFlags.Ephemeral : 0 });
    if(!mail) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.no_mail, this.client.embeds.error_color)], flags: this.client.cmdConfig.withdraw.ephemeral ? Discord.MessageFlags.Ephemeral : 0 });
    
    let channel = this.client.utils.findChannel(interaction.guild, this.client.config.channels.withdraw);
    
    let withdrawMenu = new Discord.EmbedBuilder()
      .setColor(this.client.embeds.service.withdraw.color);
    
    if(this.client.embeds.service.withdraw.title) withdrawMenu.setTitle(this.client.embeds.service.withdraw.title);
    let field = this.client.embeds.service.withdraw.fields;
    for(let i = 0; i < this.client.embeds.service.withdraw.fields.length; i++) {
      withdrawMenu.addFields([{ name: field[i].title.replace("<currency>", this.client.config.general.currency), value: field[i].description.replace("<user>", interaction.user)
      .replace("<amount>", amount)
      .replace("<currency>", this.client.config.general.currency)
      .replace("<currencySymbol>", this.client.config.general.currency_symbol)
      .replace("<mail>", mail)
      .replace("<balance>", Number(balance).toFixed(0)), inline: this.client.embeds.service.withdraw.inline }])
    }
    
    if(this.client.embeds.service.withdraw.footer == true) withdrawMenu.setFooter({ text: interaction.user.username, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) }).setTimestamp();
    if(this.client.embeds.service.withdraw.thumbnail == true) withdrawMenu.setThumbnail(interaction.user.displayAvatarURL());
    
    if(this.client.embeds.service.withdraw.description) withdrawMenu.setDescription(this.client.embeds.service.withdraw.description.replace("<user>", interaction.user)
      .replace("<amount>", amount)
      .replace("<currency>", this.client.config.general.currency)
      .replace("<currencySymbol>", this.client.config.general.currency_symbol)
      .replace("<mail>", mail)
      .replace("<balance>", Number(balance).toFixed(0)));
    
    let withdrawRow = new Discord.ActionRowBuilder().addComponents(
      new Discord.ButtonBuilder()
        .setLabel(this.client.language.buttons.withdraw_yes)
        .setEmoji(this.client.config.emojis.yes_emoji || {})
        .setCustomId(`withdraw_yes_${amount}`)
        .setStyle(Discord.ButtonStyle.Primary),
      new Discord.ButtonBuilder()
        .setLabel(this.client.language.buttons.withdraw_no)
        .setEmoji(this.client.config.emojis.no_emoji || {})
        .setCustomId(`withdraw_no_${amount}`)
        .setStyle(Discord.ButtonStyle.Danger)
    );
    
    if(channel) {
      let msg = await channel.send({ embeds: [withdrawMenu], components: [withdrawRow] });
      await this.client.database.guildData().push(`${this.client.config.general.guild}.withdrawRequests`, {
        id: msg.id,
        user: interaction.user.id,
        amount,
        mail,
      });

      await this.client.database.usersData().sub(`${interaction.user.id}.balance`, amount);
    
      interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.withdraw_request.replace("<user>", interaction.user.username).replace("<amount>", amount).replace("<balance>", Number(balance).toFixed(0)), this.client.embeds.success_color)], flags: this.client.cmdConfig.withdraw.ephemeral ? Discord.MessageFlags.Ephemeral : 0 });
    } else {
      interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.no_withdraw_channel, this.client.embeds.error_color)], flags: this.client.cmdConfig.withdraw.ephemeral ? Discord.MessageFlags.Ephemeral : 0 });
    }
  }
};