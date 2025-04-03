const Command = require("../../structures/Command");
const Discord = require("discord.js");
const { getProduct } = require("../../utils/sellix");

module.exports = class SellixProduct extends Command {
  constructor(client) {
    super(client, {
      name: "sellixproduct",
      description: client.cmdConfig.sellixproduct.description,
      usage: client.cmdConfig.sellixproduct.usage,
      permissions: client.cmdConfig.sellixproduct.permissions,
      aliases: client.cmdConfig.sellixproduct.aliases,
      category: "member",
      enabled: client.cmdConfig.sellixproduct.enabled,
      slash: true,
      options: [{
        name: "product",
        description: "Name of Sellix Product to check",
        type: Discord.ApplicationCommandOptionType.String,
        required: true
      }]
    });
  }

  async run(message, args) {
    let productId = args[0];

    if(!productId) return message.channel.send({ embeds: [this.client.utils.usage(this.client, message, this.client.cmdConfig.sellixproduct.usage)] });

    let product = await getProduct(this.client, productId);
    if(!product) return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.sellix.invalid_key, this.client.embeds.error_color)] }).then(() => {
      this.client.utils.sendError("Sellix API Key in Config File (sellix.secret) is Invalid or doesn't exist.");
    });
    if(product.status != 200) return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.sellix.no_id, this.client.embeds.error_color)] });

    let productEmbed = new Discord.EmbedBuilder()
      .setColor(this.client.embeds.sellix_product.color);

    if(this.client.embeds.sellix_product.title) productEmbed.setTitle(this.client.embeds.sellix_product.title);
    let field = this.client.embeds.sellix_product.fields;
    for(let i = 0; i < this.client.embeds.sellix_product.fields.length; i++) {
      productEmbed.addFields([{ name: field[i].title, value: field[i].description.replace("<name>", product.data.product.title)
        .replace("<description>", product.data.product.description)
        .replace("<price>", product.data.product.price)
        .replace("<stock>", product.data.product.stock)
        .replace("<tos>", product.data.product.terms_of_service), inline: this.client.embeds.sellix_product.inline }])
    }
    
    if(this.client.embeds.sellix_product.footer == true) productEmbed.setFooter({ text: `${message.author.username}`, iconURL: this.client.user.displayAvatarURL({ size: 1024, dynamic: true }) }).setTimestamp();
    if(this.client.embeds.sellix_product.thumbnail == true) productEmbed.setThumbnail(message.author.displayAvatarURL({ dynamic: true }));

    if(this.client.embeds.sellix_product.description) productEmbed.setDescription(this.client.embeds.sellix_product.description.replace("<name>", product.data.product.title)
      .replace("<description>", product.data.product.description)
      .replace("<price>", product.data.product.price)
      .replace("<stock>", product.data.product.stock)
      .replace("<tos>", product.data.product.terms_of_service));

    message.channel.send({ embeds: [productEmbed] });
  }
  async slashRun(interaction, args) {
    let productId = interaction.options.getString("product");

    let product = await getProduct(this.client, productId);
    if(!product) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.sellix.invalid_key, this.client.embeds.error_color)] }).then(() => {
      this.client.utils.sendError("Sellix API Key in Config File (sellix.secret) is Invalid or doesn't exist.");
    });
    if(product.status != 200) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.sellix.no_id, this.client.embeds.error_color)], flags: this.client.cmdConfig.sellixproduct.ephemeral ? Discord.MessageFlags.Ephemeral : 0 });

    let productEmbed = new Discord.EmbedBuilder()
      .setColor(this.client.embeds.sellix_product.color);
    
    if(this.client.embeds.sellix_product.title) productEmbed.setTitle(this.client.embeds.sellix_product.title);
    let field = this.client.embeds.sellix_product.fields;
    for(let i = 0; i < this.client.embeds.sellix_product.fields.length; i++) {
      productEmbed.addFields([{ name: field[i].title, value: field[i].description.replace("<name>", product.data.product.title)
        .replace("<description>", product.data.product.description)
        .replace("<price>", product.data.product.price)
        .replace("<stock>", product.data.product.stock)
        .replace("<tos>", product.data.product.terms_of_service), inline: this.client.embeds.sellix_product.inline }])
    }
    
    if(this.client.embeds.sellix_product.footer == true) productEmbed.setFooter({ text: `${interaction.user.username}`, iconURL: this.client.user.displayAvatarURL({ size: 1024, dynamic: true }) }).setTimestamp();
    if(this.client.embeds.sellix_product.thumbnail == true) productEmbed.setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }));
    
    if(this.client.embeds.sellix_product.description) productEmbed.setDescription(this.client.embeds.sellix_product.description.replace("<name>", product.data.product.title)
      .replace("<description>", product.data.product.description)
      .replace("<price>", product.data.product.price)
      .replace("<stock>", product.data.product.stock)
      .replace("<tos>", product.data.product.terms_of_service));
    
    interaction.reply({ embeds: [productEmbed], flags: this.client.cmdConfig.sellixproduct.ephemeral ? Discord.MessageFlags.Ephemeral : 0 });
  }
};