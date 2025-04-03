const Command = require("../../structures/Command");
const Discord = require("discord.js");
const yaml = require("yaml");
const fs = require("fs");
let paginateContent = require("../../embeds/paginateContent.js")

module.exports = class GetProduct extends Command {
  constructor(client) {
    super(client, {
      name: "getproduct",
      description: client.cmdConfig.getproduct.description,
      usage: client.cmdConfig.getproduct.usage,
      permissions: client.cmdConfig.getproduct.permissions,
      aliases: client.cmdConfig.getproduct.aliases,
      category: "member",
      enabled: client.cmdConfig.getproduct.enabled,
      slash: true,
      options: [{
        name: "id",
        description: "Product ID",
        type: Discord.ApplicationCommandOptionType.Number,
        required: true
      }]
    });
  }

  async run(message, args) {
    let productList = yaml.parse(fs.readFileSync('./configs/products.yml', 'utf8'));
    let option = args[0];
    if(!option || Number(option) > productList.products.length || Number(option) < 0 || isNaN(option)) return message.channel.send({ embeds: [this.client.utils.usage(this.client, message, this.client.cmdConfig.getproduct.usage)]});
    option = parseInt(option - 1);

    let selectedProduct = productList.products[option];
    if(!selectedProduct)
      return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.products.invalid_product, this.client.embeds.error_color)] });
    
    if(selectedProduct.type == "NONE")
      return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.products.none_type, this.client.embeds.error_color)] });

    if(selectedProduct.roles.length > 0 && !this.client.utils.hasRole(this.client, message.guild, message.member, selectedProduct.roles)) 
      return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.products.roles.replace("<role>", selectedProduct.roles.map((x) => `<@&${x}>`).join(", ").trim()), this.client.embeds.error_color)] });
    if(!this.client.utils.hasPermissions(message, message.member, selectedProduct.permissions)) 
      return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.products.permissions, this.client.embeds.error_color)] });

    await this.client.utils.downloadProduct(this.client, message, option);
  }
  async slashRun(interaction, args) {
    let productList = yaml.parse(fs.readFileSync('./configs/products.yml', 'utf8'));
    let option = interaction.options.getNumber("id");
    option = parseInt(option - 1);

    let selectedProduct = productList.products[option];
    if(!selectedProduct)
      return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.products.invalid_product, this.client.embeds.error_color)], flags: this.client.cmdConfig.getproduct.ephemeral ? Discord.MessageFlags.Ephemeral : 0 });

    if(selectedProduct.type == "NONE")
      return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.products.none_type, this.client.embeds.error_color)] });

    if(selectedProduct.roles.length > 0 && !this.client.utils.hasRole(this.client, interaction.guild, interaction.member, selectedProduct.roles)) 
      return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.products.roles.replace("<role>", selectedProduct.roles.map((x) => `<@&${x}>`).join(", ").trim()), this.client.embeds.error_color)], flags: this.client.cmdConfig.getproduct.ephemeral ? Discord.MessageFlags.Ephemeral : 0 });
    if(!this.client.utils.hasPermissions(interaction, interaction.member, selectedProduct.permissions)) 
      return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.products.permissions, this.client.embeds.error_color)], flags: this.client.cmdConfig.getproduct.ephemeral ? Discord.MessageFlags.Ephemeral : 0 });

    interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.products.file_uploading, this.client.embeds.general_color)], flags: this.client.cmdConfig.getproduct.ephemeral ? Discord.MessageFlags.Ephemeral : 0 });
    await this.client.utils.downloadProduct(this.client, interaction, option);
  }
};