const Command = require("../../structures/Command");
const { EmbedBuilder, ApplicationCommandOptionType, MessageFlags } = require("discord.js");
const fetch = require("node-fetch");

module.exports = class GetInvoice extends Command {
  constructor(client) {
    super(client, {
      name: "getinvoice",
      description: client.cmdConfig.getinvoice.description,
      usage: client.cmdConfig.getinvoice.usage,
      permissions: client.cmdConfig.getinvoice.permissions,
      aliases: client.cmdConfig.getinvoice.aliases,
      category: "service",
      enabled: client.cmdConfig.getinvoice.enabled,
      slash: true,
      options: [{
        name: 'invoice',
        type: ApplicationCommandOptionType.String,
        description: "ID of Invoice to check",
        required: true,
      }]
    });
  }

  async run(message, args) {
    const config = this.client.config;
    const language = this.client.language;
    const embeds = this.client.embeds;

    let invoiceId = args[0];
    
    if(!config.paypal.secret || !config.paypal.client_id) return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, embeds.title, language.general.paypal_cred, embeds.error_color)] });
    
    if(!invoiceId) return message.channel.send({ embeds: [this.client.utils.usage(this.client, message, this.client.cmdConfig.invoice.usage)] }); 
    const invoiceData = await this.client.database.invoicesData().get(invoiceId.toUpperCase());

    if(!invoiceData) return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, embeds.title, language.service.invalid_invoice, embeds.error_color)] });
    
    const accessToken = await this.client.utils.getPayPalToken(this.client.config.paypal.client_id, this.client.config.paypal.secret);

    await fetch(`https://api.paypal.com/v2/invoicing/invoices/${invoiceId.toUpperCase()}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
    }).then(async(invoice) => {
      if (invoice.error) {
        this.client.utils.sendError("Invalid PayPal API Secret or Client ID have been provided.");
      } else {
        let embed = new EmbedBuilder()
          .setColor(embeds.service.invoice_get.color);
        if (embeds.service.invoice_get.title) embed.setTitle(embeds.service.invoice_get.title);
        
        if (embeds.service.invoice_get.description) embed.setDescription(embeds.service.invoice_get.description.replace("<amount>", invoice.items[0].unit_amount.value)
          .replace("<seller>", invoiceData.author ? this.client.users.cache.get(invoiceData.author)?.username : 'N/A')
          .replace("<sellerId>", invoiceData.author ? invoiceData.author : 'N/A')
          .replace("<invoiceId>", invoice.id)
          .replace("<user>", invoiceData.user ? this.client.users.cache.get(invoiceData.user)?.username : 'N/A')
          .replace("<userId>", invoiceData.user ? invoiceData.user : 'N/A')
          .replace("<tos>", invoice.detail.term || 'N/A')
          .replace("<notes>", invoice.detail.note || 'N/A')
          .replace("<status>", invoice.status)
          .replace("<sellerMail>", invoice.invoicer.email_address)
          .replace("<currency>", config.general.currency)
          .replace("<currencySymbol>", config.general.currency_symbol)
          .replace("<service>", invoice.items[0].name));
        
        let field = embeds.service.invoice_get.fields;
        for (let i = 0; i < embeds.service.invoice_get.fields.length; i++) {
          embed.addFields([{ name: field[i].title.replace("<currency>", config.general.currency), value: field[i].description.replace("<amount>", invoice.items[0].unit_amount.value)
            .replace("<seller>", invoiceData.author ? this.client.users.cache.get(invoiceData.author)?.username : 'N/A')
            .replace("<sellerId>", invoiceData.author ? invoiceData.author : 'N/A')
            .replace("<invoiceId>", invoice.id)
            .replace("<user>", invoiceData.user ? this.client.users.cache.get(invoiceData.user)?.username : 'N/A')
            .replace("<userId>", invoiceData.user ? invoiceData.user : 'N/A')
            .replace("<tos>", invoice.detail.term || 'N/A')
            .replace("<notes>", invoice.detail.note || 'N/A')
            .replace("<status>", invoice.status)
            .replace("<sellerMail>", invoice.invoicer.email_address)
            .replace("<currency>", config.general.currency)
            .replace("<currencySymbol>", config.general.currency_symbol)
            .replace("<service>", invoice.items[0].name), inline: this.client.embeds.service.invoice_get.inline }])
        }
        
        if (embeds.service.invoice_get.footer == true) embed.setFooter({ text: message.author.username, iconURL: message.author.displayAvatarURL() }).setTimestamp();
        if (embeds.service.invoice_get.thumbnail == true) embed.setThumbnail(message.author.displayAvatarURL());
        
        message.channel.send({ embeds: [embed] });
      }
    });
  }
  async slashRun(interaction, args) {
    const config = this.client.config;
    const language = this.client.language;
    const embeds = this.client.embeds;

    let invoiceId = interaction.options.getString("invoice");
    const invoiceData = await this.client.database.invoicesData().get(invoiceId.toUpperCase());

    if(!config.paypal.secret || !config.paypal.client_id) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, embeds.title, language.general.paypal_cred, embeds.error_color)], flags: this.client.cmdConfig.getinvoice.ephemeral ? MessageFlags.Ephemeral : 0 });
    if(!invoiceData) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, embeds.title, language.service.invalid_invoice, embeds.error_color)], flags: this.client.cmdConfig.getinvoice.ephemeral ? MessageFlags.Ephemeral : 0 });

    const accessToken = await this.client.utils.getPayPalToken(this.client.config.paypal.client_id, this.client.config.paypal.secret);

    await fetch(`https://api.paypal.com/v2/invoicing/invoices/${invoiceId.toUpperCase()}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
    }).then(async(invoice) => {
      invoice = await invoice.json();
      if (invoice.error) {
        this.client.utils.sendError("Invalid PayPal API Secret or Client ID have been provided.");
      } else {
        let embed = new EmbedBuilder()
          .setColor(embeds.service.invoice_get.color);
        if (embeds.service.invoice_get.title) embed.setTitle(embeds.service.invoice_get.title);
        
        if (embeds.service.invoice_get.description) embed.setDescription(embeds.service.invoice_get.description.replace("<amount>", invoice.items[0].unit_amount.value)
          .replace("<seller>", invoiceData.author ? this.client.users.cache.get(invoiceData.author)?.username : 'N/A')
          .replace("<sellerId>", invoiceData.author ? invoiceData.author : 'N/A')
          .replace("<invoiceId>", invoice.id)
          .replace("<user>", invoiceData.user ? this.client.users.cache.get(invoiceData.user)?.username : 'N/A')
          .replace("<userId>", invoiceData.user ? invoiceData.user : 'N/A')
          .replace("<tos>", invoice.detail.term || 'N/A')
          .replace("<notes>", invoice.detail.note || 'N/A')
          .replace("<status>", invoice.status)
          .replace("<sellerMail>", invoice.invoicer.email_address)
          .replace("<currency>", config.general.currency)
          .replace("<currencySymbol>", config.general.currency_symbol)
          .replace("<service>", invoice.items[0].name));
        
        let field = embeds.service.invoice_get.fields;
        for (let i = 0; i < embeds.service.invoice_get.fields.length; i++) {
          embed.addFields([{ name: field[i].title.replace("<currency>", config.general.currency), value: field[i].description.replace("<amount>", invoice.items[0].unit_amount.value)
            .replace("<seller>", invoiceData.author ? this.client.users.cache.get(invoiceData.author)?.username : 'N/A')
            .replace("<sellerId>", invoiceData.author ? invoiceData.author : 'N/A')
            .replace("<invoiceId>", invoice.id)
            .replace("<user>", invoiceData.user ? this.client.users.cache.get(invoiceData.user)?.username : 'N/A')
            .replace("<userId>", invoiceData.user ? invoiceData.user : 'N/A')
            .replace("<tos>", invoice.detail.term || 'N/A')
            .replace("<notes>", invoice.detail.note || 'N/A')
            .replace("<status>", invoice.status)
            .replace("<sellerMail>", invoice.invoicer.email_address)
            .replace("<currency>", config.general.currency)
            .replace("<currencySymbol>", config.general.currency_symbol)
            .replace("<service>", invoice.items[0].name), inline: this.client.embeds.service.invoice_get.inline }])
        }
        
        if (embeds.service.invoice_get.footer == true) embed.setFooter({ text: interaction.user.username, iconURL: interaction.user.displayAvatarURL() }).setTimestamp();
        if (embeds.service.invoice_get.thumbnail == true) embed.setThumbnail(interaction.user.displayAvatarURL());
        
        interaction.reply({ embeds: [embed], flags: this.client.cmdConfig.getinvoice.ephemeral ? MessageFlags.Ephemeral : 0 });
      }
    });
  }
};
