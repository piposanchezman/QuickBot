const Command = require("../../structures/Command");
const Discord = require("discord.js");
const { getOrder } = require("../../utils/sellix");

module.exports = class SellixLicense extends Command {
  constructor(client) {
    super(client, {
      name: "sellixlicense",
      description: client.cmdConfig.sellixlicense.description,
      usage: client.cmdConfig.sellixlicense.usage,
      permissions: client.cmdConfig.sellixlicense.permissions,
      aliases: client.cmdConfig.sellixlicense.aliases,
      category: "member",
      enabled: client.cmdConfig.sellixlicense.enabled,
      slash: true,
      options: [{
        name: "order",
        description: "Order ID to Check",
        type: Discord.ApplicationCommandOptionType.String,
        required: true
      }]
    });
  }

  async run(message, args) {
    let orderId = args[0];

    if(!orderId) return message.channel.send({ embeds: [this.client.utils.usage(this.client, message, this.client.cmdConfig.sellixlicense.usage)] });

    let check = await getOrder(this.client, orderId);
    if(!check) return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.sellix.invalid_key, this.client.embeds.error_color)] }).then(() => {
      this.client.utils.sendError("Sellix API Key in Config File (sellix.secret) is Invalid or doesn't exist.");
    });
    if(check.status != 200) return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.sellix.no_id, this.client.embeds.error_color)] });

    let discordVerified = await this.client.database.guildData().get(`${this.client.config.general.guild}.sellixVerified`) || [];
    discordVerified = discordVerified.find((x) => x.key.toLowerCase() == orderId.toLowerCase());

    let licenseEmbed = new Discord.EmbedBuilder()
      .setColor(this.client.embeds.license_info.color);

    if(this.client.embeds.license_info.title) licenseEmbed.setTitle(this.client.embeds.license_info.title);
    let field = this.client.embeds.license_info.fields;
    for(let i = 0; i < this.client.embeds.license_info.fields.length; i++) {
      licenseEmbed.addFields([{ name: field[i].title, value: field[i].description.replace("<name>", check.data.order.name)
        .replace("<mail>", check.data.order.customer_email)
        .replace("<product>", check.data.order.product_title)
        .replace("<price>", check.data.order.total)
        .replace("<gateway>", check.data.order.gateway)
        .replace("<license>", orderId)
        .replace("<discord_name>", discordVerified ? `<@!${discordVerified.userId}>` : "/"), inline: this.client.embeds.license_info.inline }])
    }
    
    if(this.client.embeds.license_info.footer == true) licenseEmbed.setFooter({ text: `${message.author.username}`, iconURL: this.client.user.displayAvatarURL({ size: 1024, dynamic: true }) }).setTimestamp();
    if(this.client.embeds.license_info.thumbnail == true) licenseEmbed.setThumbnail(message.author.displayAvatarURL({ dynamic: true }));

    if(this.client.embeds.license_info.description) licenseEmbed.setDescription(this.client.embeds.license_info.description.replace("<name>", check.data.order.name)
      .replace("<mail>", check.data.order.customer_email)
      .replace("<product>", check.data.order.product_title)
      .replace("<price>", check.data.order.total)
      .replace("<gateway>", check.data.order.gateway)
      .replace("<license>", orderId)
      .replace("<discord_name>", discordVerified ? `<@!${discordVerified.userId}>` : "/"));

    message.channel.send({ embeds: [licenseEmbed] });
  }
  async slashRun(interaction, args) {
    let orderId = interaction.options.getString("order");

    let check = await getOrder(this.client, orderId);
    if(!check) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.sellix.invalid_key, this.client.embeds.error_color)] }).then(() => {
      this.client.utils.sendError("Sellix API Key in Config File (sellix.secret) is Invalid or doesn't exist.");
    });
    if(check.status != 200) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.sellix.no_id, this.client.embeds.error_color)], flags: this.client.cmdConfig.sellixlicense.ephemeral ? Discord.MessageFlags.Ephemeral : 0 });
    
    let discordVerified = await this.client.database.guildData().get(`${this.client.config.general.guild}.sellixVerified`) || [];
    discordVerified = discordVerified.find((x) => x.key.toLowerCase() == orderId.toLowerCase());
    
    let licenseEmbed = new Discord.EmbedBuilder()
      .setColor(this.client.embeds.license_info.color);
    
    if(this.client.embeds.license_info.title) licenseEmbed.setTitle(this.client.embeds.license_info.title);
    let field = this.client.embeds.license_info.fields;
    for(let i = 0; i < this.client.embeds.license_info.fields.length; i++) {
      licenseEmbed.addFields([{ name: field[i].title, value: field[i].description.replace("<name>", check.data.order.name)
        .replace("<mail>", check.data.order.customer_email)
        .replace("<product>", check.data.order.product_title)
        .replace("<price>", check.data.order.total)
        .replace("<gateway>", check.data.order.gateway)
        .replace("<license>", orderId)
        .replace("<discord_name>", discordVerified ? `<@!${discordVerified.userId}>` : "/"), inline: this.client.embeds.license_info.inline }])
    }
    
    if(this.client.embeds.license_info.footer == true) licenseEmbed.setFooter({ text: `${interaction.user.username}`, iconURL: this.client.user.displayAvatarURL({ size: 1024, dynamic: true }) }).setTimestamp();
    if(this.client.embeds.license_info.thumbnail == true) licenseEmbed.setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }));
    
    if(this.client.embeds.license_info.description) licenseEmbed.setDescription(this.client.embeds.license_info.description.replace("<name>", check.data.order.name)
      .replace("<mail>", check.data.order.customer_email)
      .replace("<product>", check.data.order.product_title)
      .replace("<price>", check.data.order.total)
      .replace("<gateway>", check.data.order.gateway)
      .replace("<license>", orderId)
      .replace("<discord_name>", discordVerified ? `<@!${discordVerified.userId}>` : "/"));
    
    interaction.reply({ embeds: [licenseEmbed], flags: this.client.cmdConfig.sellixlicense.ephemeral ? Discord.MessageFlags.Ephemeral : 0 });
  }
};