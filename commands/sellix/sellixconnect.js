const Command = require("../../structures/Command");
const Discord = require("discord.js");
const { getOrder } = require("../../utils/sellix");

module.exports = class SellixConnect extends Command {
  constructor(client) {
    super(client, {
      name: "sellixconnect",
      description: client.cmdConfig.sellixconnect.description,
      usage: client.cmdConfig.sellixconnect.usage,
      permissions: client.cmdConfig.sellixconnect.permissions,
      aliases: client.cmdConfig.sellixconnect.aliases,
      category: "member",
      enabled: client.cmdConfig.sellixconnect.enabled,
      slash: true,
      options: [{
        name: "order",
        description: "Order ID to Connect",
        type: Discord.ApplicationCommandOptionType.String,
        required: true
      }]
    });
  }

  async run(message, args) {
    let config = this.client.config;
    let orderId = args[0];
    let productName = "";
    let rolesObtained = [];
    
    if(!orderId) return message.channel.send({ embeds: [this.client.utils.usage(this.client, message, this.client.cmdConfig.sellixconnect.usage)] });

    let check = await getOrder(this.client, orderId);
    if(!check) return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.sellix.invalid_key, this.client.embeds.error_color)] }).then(() => {
      this.client.utils.sendError("Sellix API Key in Config File (sellix.secret) is Invalid or doesn't exist.");
    });
    if(check.status != 200) return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.sellix.no_id, this.client.embeds.error_color)] });

    let verifiedList = await this.client.database.guildData().get(`${this.client.config.general.guild}.sellixVerified`) || [];
    if(verifiedList.find((x) => x.key.toLowerCase() == orderId.toLowerCase())) return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.sellix.used_id, this.client.embeds.error_color)] });

    await this.client.database.guildData().push(`${this.client.config.general.guild}.${this.client.config.general.guild}.sellixVerified`, {
      userId: message.author.id,
      key: orderId
    });

    if(this.client.config.sellix.separateProducts == true && this.client.config.sellix.products.length > 0) {
      let findProduct = this.client.config.sellix.products.find((x) => x.name.toLowerCase() == check.data.order.product_title.toLowerCase());
      if(!findProduct) return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.sellix.no_product, this.client.embeds.error_color)] });
      if(findProduct.roles.length == 0) return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.sellix.no_roles, this.client.embeds.error_color)] });
      productName = findProduct.name;
      findProduct.roles.forEach(async(x) => {
        let findRole = this.client.utils.findRole(message.guild, x);
        if(findRole) rolesObtained.push(findRole);
        if(findRole) await message.member.roles.add(findRole).catch((err) => {})
      });
      if(rolesObtained.length == 0) return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.sellix.no_roles, this.client.embeds.error_color)] });
    } else {
      if(this.client.config.sellix.roles.length == 0) return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.sellix.no_roles, this.client.embeds.error_color)] });
      productName = check.data.order.product_title;
      this.client.config.sellix.roles.forEach(async(x) => {
        let findRole = this.client.utils.findRole(message.guild, x);
        if(findRole) rolesObtained.push(findRole);
        if(findRole) await message.member.roles.add(findRole).catch((err) => {})
      });
    }

    message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.sellix.verified.replace("<product>", productName).replace("<roles>", rolesObtained.join(", ").trim()), this.client.embeds.success_color)] });
  }
  async slashRun(interaction, args) {
    let config = this.client.config;
    let orderId = interaction.options.getString("order");
    let productName = "";
    let rolesObtained = [];
    
    let check = await getOrder(this.client, orderId);
    if(!check) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.sellix.invalid_key, this.client.embeds.error_color)] }).then(() => {
      this.client.utils.sendError("Sellix API Key in Config File (sellix.secret) is Invalid or doesn't exist.");
    });
    if(check.status != 200) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.sellix.no_id, this.client.embeds.error_color)], flags: this.client.cmdConfig.sellixconnect.ephemeral ? Discord.MessageFlags.Ephemeral : 0 });

    let verifiedList = await this.client.database.guildData().get(`${this.client.config.general.guild}.sellixVerified`) || [];
    if(verifiedList.find((x) => x.key.toLowerCase() == orderId.toLowerCase())) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.sellix.used_id, this.client.embeds.error_color)], flags: this.client.cmdConfig.sellixconnect.ephemeral ? Discord.MessageFlags.Ephemeral : 0 });

    await this.client.database.guildData().push(`${this.client.config.general.guild}.${this.client.config.general.guild}.sellixVerified`, {
      userId: interaction.user.id,
      key: orderId
    });

    if(this.client.config.sellix.separateProducts == true) {
      let findProduct = this.client.config.sellix.products.find((x) => x.name.toLowerCase() == check.data.order.product_title.toLowerCase());
      if(!findProduct) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.sellix.no_product, this.client.embeds.error_color)] });
      if(findProduct.roles.length == 0) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.sellix.no_roles, this.client.embeds.error_color)] });
      productName = findProduct.name;
      findProduct.roles.forEach(async(x) => {
        let findRole = this.client.utils.findRole(interaction.guild, x);
        if(findRole) rolesObtained.push(findRole);
        if(findRole) await interaction.member.roles.add(findRole).catch((err) => {})
      });
      if(rolesObtained.length == 0) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.sellix.no_roles, this.client.embeds.error_color)] });
    } else {
      if(this.client.config.sellix.roles.length == 0) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.sellix.no_roles, this.client.embeds.error_color)] });
      productName = check.data.order.product_title;
      this.client.config.sellix.roles.forEach(async(x) => {
        let findRole = this.client.utils.findRole(interaction.guild, x);
        if(findRole) rolesObtained.push(findRole);
        if(findRole) await interaction.member.roles.add(x).catch((err) => {});
      });
    }

    interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.sellix.verified.replace("<product>", productName).replace("<roles>", rolesObtained.join(", ").trim()), this.client.embeds.success_color)], flags: this.client.cmdConfig.sellixconnect.ephemeral ? Discord.MessageFlags.Ephemeral : 0 });
  }
};
