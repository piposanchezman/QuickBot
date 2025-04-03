const Command = require("../../structures/Command");
const { EmbedBuilder, ActionRowBuilder, 
  ButtonBuilder, ApplicationCommandOptionType, ButtonStyle } = require("discord.js");
const fetch = require("node-fetch");

module.exports = class Invoice extends Command {
  constructor(client) {
    super(client, {
      name: "invoice",
      description: client.cmdConfig.invoice.description,
      usage: client.cmdConfig.invoice.usage,
      permissions: client.cmdConfig.invoice.permissions,
      aliases: client.cmdConfig.invoice.aliases,
      category: "service",
      enabled: client.cmdConfig.invoice.enabled,
      slash: true,
      options: [{
        name: 'user',
        type: ApplicationCommandOptionType.User,
        description: "User to create invoice for",
        required: true,
      }, {
        name: 'amount',
        type: ApplicationCommandOptionType.Number,
        description: "Amount of Money to send",
        required: true,
      }, {
        name: 'service',
        type: ApplicationCommandOptionType.String,
        description: "Service User's paying for",
        required: true,
      }]
    });
  }

  async run(message, args) {
    const config = this.client.config;
    const language = this.client.language;
    const embeds = this.client.embeds;

    let user = message.mentions.users.first();
    let amount = args[1];
    let service = args.slice(2).join(" ");
    
    if(!config.paypal.secret || !config.paypal.client_id) return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, embeds.title, language.general.paypal_cred, embeds.error_color)] });
    
    if(!user || !service) return message.channel.send({ embeds: [this.client.utils.usage(this.client, message, this.client.cmdConfig.invoice.usage)] }); 
    if(!amount || isNaN(amount)) return message.channel.send({ embeds: [this.client.utils.usage(this.client, message, this.client.cmdConfig.invoice.usage)] }); 
    
    const ticketData = await this.client.database.ticketsData().get(`${message.channel.id}.ticketData`) || {};

    let basePrice = Number(amount);
    if(this.client.config.paypal.taxes.length > 0) {
      basePrice = this.client.utils.priceWithTax(this.client, basePrice);
    }

    const taxList = this.client.config.paypal.taxes.map((x) => {
      return this.client.language.service.taxes_format.replace("<name>", x.name)
        .replace("<amount>", x.type == "NUMBER" ? this.client.config.general.currency_symbol + x.amount : x.amount + "%")
    });

    let invoiceObject = {
      detail: {
        currency_code: config.general.currency,
        terms_and_conditions: config.paypal.tos,
        note: config.paypal.notes.replace("<username>", user.username)
          .replace("<userId>", user.id)
          .replace("<author>", message.author.username)
          .replace("<authorId>", message.author.id)
          .replace("<taxList>", taxList.length == 0 ? "N/A" : taxList.join("\n"))
          .replace("<date>", new Date().toLocaleString("en-GB")),
        payment_term: {
          term_type: "NET_45"
        }
      },
      invoicer: {
        email_address: config.paypal.mail
      },
      invoicer: {
        business_name: config.paypal.title,
        logo_url: message.guild.iconURL(),
        email_address: config.paypal.mail,
      },
      configuration: {
        tax_inclusive: true,
      },
      items: [{
        name: service,
        quantity: "1.0",
        unit_amount: {
          currency_code: config.general.currency,
          value: basePrice
        },
      }],
    }
    
    const validDays = [10, 15, 30, 45, 60, 90];
    if(validDays.includes(config.paypal.days)) {
      invoiceObject.detail.payment_term.term_type = "NET_" + config.paypal.days;
    } else if(!validDays.includes(config.paypal.days) && config.paypal.days > 0) {
      this.client.utils.sendError("Invalid Number of Days for PayPal Invocie specified in config.yml");
    }

    const accessToken = await this.client.utils.getPayPalToken(this.client.config.paypal.client_id, this.client.config.paypal.secret);
    
    await fetch(`https://api.paypal.com/v2/invoicing/invoices`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify(invoiceObject)
    }).then(async(res) => {
      const invoice = await res.json();

      if(invoice.error) {
        console.error(invoice.error_description)
      } else {
        await fetch(invoice.href + "/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ send_to_invoicer: false, send_to_recipient: false })
        }).then(async(resp) => {
          const invoiceSentData = await resp.json();
          if(invoiceSentData.error) {
            console.error(invoiceSentData.error_description)
          } else {
            const invoiceId = invoice.href.split("invoices/")[1];

            let embed = new EmbedBuilder()
              .setColor(embeds.service.invoice_create.color);
            if (embeds.service.invoice_create.title) embed.setTitle(embeds.service.invoice_create.title);
            
            if (embeds.service.invoice_create.description) embed.setDescription(embeds.service.invoice_create.description.replace("<amount>", amount)
              .replace("<amountWithTax>", basePrice)
              .replace("<taxList>", taxList.length == 0 ? "N/A" : taxList.join("\n"))
              .replace("<seller>", message.author)
              .replace("<invoiceId>", invoiceId)
              .replace("<user>", user.username)
              .replace("<userId>", user.id)
              .replace("<mail>", config.paypal.mail)
              .replace("<currency>", config.general.currency)
              .replace("<currencySymbol>", config.general.currency_symbol)
              .replace("<service>", service));
            
            let field = embeds.service.invoice_create.fields;
            for (let i = 0; i < embeds.service.invoice_create.fields.length; i++) {
              embed.addFields([{ name: field[i].title.replace("<currency>", config.general.currency), value: field[i].description.replace("<amount>", amount)
                .replace("<amountWithTax>", basePrice)
                .replace("<taxList>", taxList.length == 0 ? "N/A" : taxList.join("\n"))
                .replace("<seller>", message.author)
                .replace("<invoiceId>", invoiceId)
                .replace("<user>", user.username)
                .replace("<userId>", user.id)
                .replace("<mail>", config.paypal.mail)
                .replace("<currency>", config.general.currency)
                .replace("<currencySymbol>", config.general.currency_symbol)
                .replace("<service>", service), inline: this.client.embeds.service.invoice_create.inline }])
            }
            
            if (embeds.service.invoice_create.footer == true) embed.setFooter({ text: message.author.username, iconURL: message.author.displayAvatarURL() }).setTimestamp();
            if (embeds.service.invoice_create.thumbnail == true) embed.setThumbnail(message.author.displayAvatarURL());
            
            const row = new ActionRowBuilder()
              .addComponents(
                new ButtonBuilder()
                .setURL(`https://www.paypal.com/invoice/payerView/details/${invoiceId}`)
                .setLabel(language.buttons.invoice)
                .setStyle(ButtonStyle.Link),
              );
            
            message.channel.send({ embeds: [embed], components: [row] });
            
            await this.client.database.invoicesData().set(invoiceId, {
              id: invoiceId,
              guild: message.guild.id,
              author: `${message.author.id}`,
              user: `${user.id}`,
              amount,
              amountWithTax: basePrice,
              service,
              date: new Date().toLocaleString("en-GB")
            });

            await this.client.utils.serverLogs(this.client, {
              date: new Date().toLocaleString("en-GB"),
              author_id: message.author.id,
              author: message.author.username,
              user_id: user.id,
              user: user.username,
              channel_id: `${message.channel.id}`,
              channel_name: `${message.channel.name}`,
              invoice_id: invoiceId,
              invoice_amount: basePrice,
              ticketId: ticketData.id || "N/A",
              message: `invoice_created`
            });

            let checkInvoice = setInterval(async () => {
              await fetch(invoice.href, {
                method: "GET",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${accessToken}`,
                },
              }).then(async(invoiceData) => {
                if (invoiceData?.status == "PAID" || invoiceData?.status == "MARKED_AS_PAID") {
                  if(config.paypal.invoice_paid == true) {
                    let invoiceEmbed = new EmbedBuilder()
                      .setColor(embeds.service.invoice_paid.color);
                    if (embeds.service.invoice_paid.title) invoiceEmbed.setTitle(embeds.service.invoice_paid.title);
              
                    if (embeds.service.invoice_paid.description) invoiceEmbed.setDescription(embeds.service.invoice_paid.description.replace("<amount>", amount)
                      .replace("<amountWithTax>", basePrice)
                      .replace("<taxList>", taxList.length == 0 ? "N/A" : taxList.join("\n"))
                      .replace("<seller>", message.author)
                      .replace("<invoiceId>", invoiceId)
                      .replace("<user>", user.username)
                      .replace("<userId>", user.id)
                      .replace("<mail>", config.paypal.mail)
                      .replace("<currency>", config.general.currency)
                      .replace("<currencySymbol>", config.general.currency_symbol)
                      .replace("<service>", service));
              
                    let field = embeds.service.invoice_paid.fields;
                    for (let i = 0; i < embeds.service.invoice_paid.fields.length; i++) {
                      invoiceEmbed.addFields([{ name: field[i].title.replace("<currency>", config.general.currency), value: field[i].description.replace("<amount>", amount)
                        .replace("<amountWithTax>", basePrice)
                        .replace("<taxList>", taxList.length == 0 ? "N/A" : taxList.join("\n"))
                        .replace("<seller>", message.author)
                        .replace("<invoiceId>", invoiceId)
                        .replace("<user>", user.username)
                        .replace("<userId>", user.id)
                        .replace("<mail>", config.paypal.mail)
                        .replace("<currency>", config.general.currency)
                        .replace("<currencySymbol>", config.general.currency_symbol)
                        .replace("<service>", service), inline: this.client.embeds.service.invoice_paid.inline }])
                    }
              
                    if (embeds.service.invoice_paid.footer == true) invoiceEmbed.setFooter({ text: message.author.username, iconURL: message.author.displayAvatarURL() }).setTimestamp();
                    if (embeds.service.invoice_paid.thumbnail == true) invoiceEmbed.setThumbnail(message.author.displayAvatarURL());
                    message.channel.send({ embeds: [invoiceEmbed] }).catch((err) => { });
                  }

                  await this.client.utils.serverLogs(this.client, {
                    date: new Date().toLocaleString("en-GB"),
                    author_id: message.author.id,
                    author: message.author.username,
                    user_id: user.id,
                    user: user.username,
                    channel_id: `${message.channel.id}`,
                    channel_name: `${message.channel.name}`,
                    invoice_id: invoiceId,
                    invoice_amount: basePrice,
                    ticketId: ticketData.id || "N/A",
                    message: `invoice_paid`
                  });

                  await this.client.database.guildData().add(`${this.client.config.general.guild}.totalInvoices`, 1);
                  clearInterval(checkInvoice);

                  let memberUser = message.guild.members.cache.get(user.id);
                  if(memberUser && config.paypal.roles_give.length > 0) config.paypal.roles_give.forEach(async(r) => {
                    let findRole = this.client.utils.findRole(message.guild, r);
                    await memberUser.roles.add(findRole).catch((err) => {})
                  });
                }
              });
            }, 30000);
          }
        })
      }
    })
  }
  async slashRun(interaction, args) {
    const config = this.client.config;
    const language = this.client.language;
    const embeds = this.client.embeds;
    
    let user = interaction.options.getUser("user");
    let amount = interaction.options.getNumber("amount");
    let service = interaction.options.getString("service");
    
    if(!config.paypal.secret || !config.paypal.client_id) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, embeds.title, language.general.paypal_cred, embeds.error_color)] });
    if(isNaN(amount)) return interaction.reply({ embeds: [this.client.utils.usage(this.client, interaction, this.client.cmdConfig.invoice.usage)] });
    
    const ticketData = await this.client.database.ticketsData().get(`${interaction.channel.id}.ticketData`) || {};

    let basePrice = Number(amount);
    if(this.client.config.paypal.taxes.length > 0) {
      basePrice = this.client.utils.priceWithTax(this.client, basePrice);
    }

    const taxList = this.client.config.paypal.taxes.map((x) => {
      return this.client.language.service.taxes_format.replace("<name>", x.name)
        .replace("<amount>", x.type == "NUMBER" ? this.client.config.general.currency_symbol + x.amount : x.amount + "%")
    });

    let invoiceObject = {
      detail: {
        currency_code: config.general.currency,
        terms_and_conditions: config.paypal.tos,
        note: config.paypal.notes.replace("<username>", user.username)
          .replace("<userId>", user.id)
          .replace("<author>", interaction.user.username)
          .replace("<authorId>", interaction.user.id)
          .replace("<taxList>", taxList.length == 0 ? "N/A" : taxList.join("\n"))
          .replace("<date>", new Date().toLocaleString("en-GB")),
        payment_term: {
          term_type: "NET_45"
        }
      },
      invoicer: {
        email_address: config.paypal.mail
      },
      invoicer: {
        business_name: config.paypal.title,
        logo_url: interaction.guild.iconURL(),
        email_address: config.paypal.mail,
      },
      configuration: {
        tax_inclusive: true,
      },
      items: [{
        name: service,
        quantity: "1.0",
        unit_amount: {
          currency_code: config.general.currency,
          value: basePrice
        },
      }],
    }
    
    const validDays = [10, 15, 30, 45, 60, 90];
    if(validDays.includes(config.paypal.days)) {
      invoiceObject.detail.payment_term.term_type = "NET_" + config.paypal.days;
    } else if(!validDays.includes(config.paypal.days) && config.paypal.days > 0) {
      this.client.utils.sendError("Invalid Number of Days for PayPal Invocie specified in config.yml");
    }

    await interaction.deferReply();

    const accessToken = await this.client.utils.getPayPalToken(this.client.config.paypal.client_id, this.client.config.paypal.secret);
    
    await fetch(`https://api.paypal.com/v2/invoicing/invoices`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify(invoiceObject)
    }).then(async(res) => {
      const invoice = await res.json();

      if(invoice.error) {
        console.error(invoice.error_description)
      } else {
        await fetch(invoice.href + "/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ send_to_invoicer: false, send_to_recipient: false })
        }).then(async(resp) => {
          const invoiceSentData = await resp.json();
          if(invoiceSentData.error) {
            console.error(invoiceSentData.error_description)
          } else {
            const invoiceId = invoice.href.split("invoices/")[1];
            let embed = new EmbedBuilder()
              .setColor(embeds.service.invoice_create.color);
            if (embeds.service.invoice_create.title) embed.setTitle(embeds.service.invoice_create.title);
    
            if (embeds.service.invoice_create.description) embed.setDescription(embeds.service.invoice_create.description.replace("<amount>", amount)
              .replace("<amountWithTax>", basePrice)
              .replace("<taxList>", taxList.length == 0 ? "N/A" : taxList.join("\n"))
              .replace("<seller>", interaction.user)
              .replace("<invoiceId>", invoiceId)
              .replace("<user>", user.username)
              .replace("<userId>", user.id)
              .replace("<mail>", config.paypal.mail)
              .replace("<currency>", config.general.currency)
              .replace("<currencySymbol>", config.general.currency_symbol)
              .replace("<service>", service));
    
            let field = embeds.service.invoice_create.fields;
            for (let i = 0; i < embeds.service.invoice_create.fields.length; i++) {
              embed.addFields([{ name: field[i].title.replace("<currency>", config.general.currency), value: field[i].description.replace("<amount>", amount)
                .replace("<amountWithTax>", basePrice)
                .replace("<taxList>", taxList.length == 0 ? "N/A" : taxList.join("\n"))
                .replace("<seller>", interaction.user)
                .replace("<invoiceId>", invoiceId)
                .replace("<user>", user.username)
                .replace("<userId>", user.id)
                .replace("<mail>", config.paypal.mail)
                .replace("<currency>", config.general.currency)
                .replace("<currencySymbol>", config.general.currency_symbol)
                .replace("<service>", service), inline: this.client.embeds.service.invoice_create.inline }])
            }
    
            if (embeds.service.invoice_create.footer == true) embed.setFooter({ text: interaction.user.username, iconURL: interaction.user.displayAvatarURL() }).setTimestamp();
            if (embeds.service.invoice_create.thumbnail == true) embed.setThumbnail(interaction.user.displayAvatarURL());
    
            const row = new ActionRowBuilder()
              .addComponents(
                new ButtonBuilder()
                .setURL(`https://www.paypal.com/invoice/payerView/details/${invoiceId}`)
                .setLabel(language.buttons.invoice)
                .setStyle(ButtonStyle.Link),
              );
    
            interaction.followUp({ embeds: [embed], components: [row] });
            
            await this.client.database.invoicesData().set(invoiceId, {
              id: invoiceId,
              guild: interaction.guild.id,
              author: `${interaction.user.id}`,
              user: `${user.id}`,
              amount,
              amountWithTax: basePrice,
              service,
              date: new Date().toLocaleString("en-GB")
            });

            await this.client.utils.serverLogs(this.client, {
              date: new Date().toLocaleString("en-GB"),
              author_id: interaction.user.id,
              author: interaction.user.username,
              user_id: user.id,
              user: user.username,
              channel_id: `${interaction.channel.id}`,
              channel_name: `${interaction.channel.name}`,
              invoice_id: invoiceId,
              invoice_amount: basePrice,
              ticketId: ticketData.id || "N/A",
              message: `invoice_created`
            });
            
            let checkInvoice = setInterval(async () => {
              await fetch(invoice.href, {
                method: "GET",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${accessToken}`,
                },
              }).then(async(invoiceData) => {
                if(invoiceData?.status == "PAID" || invoiceData?.status == "MARKED_AS_PAID") {
                  if(config.paypal.invoice_paid == true) {
                    let invoiceEmbed = new EmbedBuilder()
                      .setColor(embeds.service.invoice_paid.color);
                    if (embeds.service.invoice_paid.title) invoiceEmbed.setTitle(embeds.service.invoice_paid.title);
                    
                    if (embeds.service.invoice_paid.description) invoiceEmbed.setDescription(embeds.service.invoice_paid.description.replace("<amount>", amount)
                      .replace("<amountWithTax>", basePrice)
                      .replace("<taxList>", taxList.length == 0 ? "N/A" : taxList.join("\n"))
                      .replace("<seller>", interaction.user)
                      .replace("<invoiceId>", invoiceId)
                      .replace("<user>", user.username)
                      .replace("<userId>", user.id)
                      .replace("<mail>", config.paypal.mail)
                      .replace("<currency>", config.general.currency)
                      .replace("<currencySymbol>", config.general.currency_symbol)
                      .replace("<service>", service));
                    
                    let field = embeds.service.invoice_paid.fields;
                    for (let i = 0; i < embeds.service.invoice_paid.fields.length; i++) {
                      invoiceEmbed.addFields([{ name: field[i].title.replace("<currency>", config.general.currency), value: field[i].description.replace("<amount>", amount)
                        .replace("<amountWithTax>", basePrice)
                        .replace("<taxList>", taxList.length == 0 ? "N/A" : taxList.join("\n"))
                        .replace("<seller>", interaction.user)
                        .replace("<invoiceId>", invoiceId)
                        .replace("<user>", user.username)
                        .replace("<userId>", user.id)
                        .replace("<mail>", config.paypal.mail)
                        .replace("<currency>", config.general.currency)
                        .replace("<currencySymbol>", config.general.currency_symbol)
                        .replace("<service>", service), inline: this.client.embeds.service.invoice_paid.inline }])
                    }
                    
                    if (embeds.service.invoice_paid.footer == true) invoiceEmbed.setFooter({ text: interaction.user.username, iconURL: interaction.user.displayAvatarURL() }).setTimestamp();
                    if (embeds.service.invoice_paid.thumbnail == true) invoiceEmbed.setThumbnail(interaction.user.displayAvatarURL());
                    interaction.channel.send({ embeds: [invoiceEmbed ]}).catch((err) => { });
                  }

                  await this.client.utils.serverLogs(this.client, {
                    date: new Date().toLocaleString("en-GB"),
                    author_id: interaction.user.id,
                    author: interaction.user.username,
                    user_id: user.id,
                    user: user.username,
                    channel_id: `${interaction.channel.id}`,
                    channel_name: `${interaction.channel.name}`,
                    invoice_id: invoiceId,
                    invoice_amount: basePrice,
                    ticketId: ticketData.id || "N/A",
                    message: `invoice_paid`
                  });
                  
                  await this.client.database.guildData().add(`${this.client.config.general.guild}.totalInvoices`, 1);
                  clearInterval(checkInvoice);

                  let memberUser = interaction.guild.members.cache.get(user.id);
                  if(memberUser && config.paypal.roles_give.length > 0) config.paypal.roles_give.forEach(async(r) => {
                    let findRole = this.client.utils.findRole(interaction.guild, r);
                    await memberUser.roles.add(findRole).catch((err) => {})
                  });
                }
              });
            }, 30000);
          }
        })
      }
    });
  }
};