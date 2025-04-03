const Command = require("../../structures/Command");
const { ApplicationCommandOptionType, ChannelType, MessageFlags } = require("discord.js");

module.exports = class Edit extends Command {
  constructor(client) {
    super(client, {
      name: "edit",
      description: client.cmdConfig.edit.description,
      usage: client.cmdConfig.edit.usage,
      permissions: client.cmdConfig.edit.permissions,
      aliases: client.cmdConfig.edit.aliases,
      category: "service",
      enabled: client.cmdConfig.edit.enabled,
      slash: true,
      options: [{
        name: "user",
        type: ApplicationCommandOptionType.Subcommand,
        description: "Edit User data",
        options: [{
          name: "target",
          description: "User whose data to edit",
          type: ApplicationCommandOptionType.User,
          required: true
        }, {
          name: "action",
          description: "Add order to user",
          type: ApplicationCommandOptionType.String,
          choices: [{
            name: "Add Order",
            value: "addorder"
          }, {
            name: "Remove Order",
            value: "removeorder"
          }, {
            name: "Delete Review",
            value: "deletereview"
          }, {
            name: "Add Balance",
            value: "addbalance"
          }, {
            name: "Remove Balance",
            value: "removebalance"
          }],
          required: true
        }, {
          name: "value",
          description: "Amount/Value/Review ID",
          type: ApplicationCommandOptionType.String,
          required: true
        }]
      }, {
        name: "commission",
        type: ApplicationCommandOptionType.Subcommand,
        description: "Edit Commission data",
        options: [{
          name: "channel",
          description: "Commission Channel to edit",
          type: ApplicationCommandOptionType.Channel,
          channelTypes: [ChannelType.GuildText],
          required: true
        }, {
          name: "action",
          description: "Action you want to do on Commission",
          type: ApplicationCommandOptionType.String,
          choices: [{
            name: "Change Base Price",
            value: "commprice"
          }],
          required: true
        }, {
          name: "value",
          description: "Value to what to change it to",
          type: ApplicationCommandOptionType.String,
          required: true
        }]
      }]
    });
  }

  async run(message, args) {
    const target = message.mentions.users.first() || this.client.users.cache.get(args[0]);
    const action = args[1];
    const value = args[2];
  
    if(!action || !target || !value || (action != "deletereview" && isNaN(value))) return message.channel.send({ embeds: [this.client.utils.usage(this.client, message, this.client.cmdConfig.edit.usage)] });
  
    if(action.toLowerCase() == "addorder") {
      const clientProfile = await this.client.database.usersData().get(`${target.id}.clientProfile`) || {
        orderCount: 0,
        amountSpent: 0,
      };
  
      let basePrice = Number(value);
      if(this.client.config.paypal.taxes.length > 0) {
        basePrice = this.client.utils.priceWithTax(this.client, basePrice);
      }
  
      clientProfile.orderCount++;
      clientProfile.amountSpent += Number(basePrice);
      await this.client.database.usersData().set(`${target.id}.clientProfile`, clientProfile);
    } else if(action.toLowerCase() == "removeorder") {
      const clientProfile = await this.client.database.usersData().get(`${target.id}.clientProfile`) || {
        orderCount: 0,
        amountSpent: 0,
      };
  
      if(clientProfile.amountSpent < Number(value)) return message.channel.send({ embeds: [this.client.utils.usage(this.client, message, this.client.cmdConfig.edit.usage)] });
  
      let basePrice = Number(value);
      if(this.client.config.paypal.taxes.length > 0) {
        basePrice = this.client.utils.priceWithTax(this.client, basePrice);
      }
  
      clientProfile.orderCount--;
      clientProfile.amountSpent -= Number(basePrice);
      await this.client.database.usersData().set(`${target.id}.clientProfile`, clientProfile);
    } else if(action.toLowerCase() == "deletereview") {
      let data = await this.client.database.usersData().get(`${target.id}.reviews`) || [];
    
      let find = data.find((d) => d.id.toLowerCase() == value.toLowerCase() && d.user == target.id);
      if(!find) return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.language.titles.error, this.client.language.service.no_review, this.client.embeds.error_color )] });
  
      data = data.filter((d) => d != find);
      await this.client.database.usersData().set(`${target.id}.reviews`, data); 
    } else if(action.toLowerCase() == "addbalance") {
      await this.client.utils.serverLogs(this.client, {
        date: new Date().toLocaleString("en-GB"),
        author_id: message.author.id,
        author: message.author.username,
        user_id: target.id,
        user: target.username,
        channel_id: `${message.channel.id}`,
        channel_name: `${message.channel.name}`,
        ticketId: null,
        amount: Number(value),
        message: `balance_add`
      });

      await this.client.database.usersData().add(`${target.id}.balance`, Number(value));
    } else if(action.toLowerCase() == "removebalance") {
      await this.client.utils.serverLogs(this.client, {
        date: new Date().toLocaleString("en-GB"),
        author_id: message.author.id,
        author: message.author.username,
        user_id: target.id,
        user: user.username,
        user: target.username,
        channel_id: `${message.channel.id}`,
        channel_name: `${message.channel.name}`,
        ticketId: null,
        amount: Number(value),
        message: `balance_remove`
      });

      await this.client.database.usersData().sub(`${target.id}.balance`, Number(value));
    } else if(action.toLowerCase() == "commprice") {
      let commission = await this.client.database.ticketsData().get(`${target.id}.commission`);
      if(!commission || commission?.status == "NO_STATUS") return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.service.commission.not_commission, this.client.embeds.error_color)] });

      commission.quoteList[0].price = Number(value) || Number(commission.quoteList[0].price);
      await this.client.database.ticketsData().set(`${target.id}.commission`, commission);
      await target.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.service.price_edited.replace("<user>", interaction.user).replace("<currencySymbol>", this.client.config.general.currency_symbol).replace("<amount>", Number(value)), this.client.embeds.success_color)] });
    }
    message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.service.data_edited.replace("<target>", target), this.client.embeds.success_color)] });
  }
  async slashRun(interaction, args) {
    let target;
    const action = interaction.options.getString("action");
    if(args[0] == "user") target = interaction.options.getUser("target");
    else target = interaction.options.getChannel("channel");
    const value = interaction.options.getString("value");
    
    if(action.toLowerCase() == "addorder") {
      const clientProfile = await this.client.database.usersData().get(`${target.id}.clientProfile`) || {
        orderCount: 0,
        amountSpent: 0,
      };
  
      let basePrice = Number(value);
      if(this.client.config.paypal.taxes.length > 0) {
        basePrice = this.client.utils.priceWithTax(this.client, basePrice);
      }
  
      clientProfile.orderCount++;
      clientProfile.amountSpent += Number(basePrice);
      await this.client.database.usersData().set(`${target.id}.clientProfile`, clientProfile);
    } else if(action.toLowerCase() == "removeorder") {
      const clientProfile = await this.client.database.usersData().get(`${target.id}.clientProfile`) || {
        orderCount: 0,
        amountSpent: 0,
      };
  
      if(clientProfile.amountSpent < Number(value)) return interaction.reply({ embeds: [this.client.utils.usage(this.client, interaction, this.client.cmdConfig.edit.usage)], flags: this.client.cmdConfig.edit.ephemeral ? MessageFlags.Ephemeral : 0 });
  
      let basePrice = Number(value);
      if(this.client.config.paypal.taxes.length > 0) {
        basePrice = this.client.utils.priceWithTax(this.client, basePrice);
      }
  
      clientProfile.orderCount--;
      clientProfile.amountSpent -= Number(basePrice);
      await this.client.database.usersData().set(`${target.id}.clientProfile`, clientProfile);
    } else if(action.toLowerCase() == "deletereview") {
      let data = await this.client.database.usersData().get(`${target.id}.reviews`) || [];
    
      let find = data.find((d) => d.id.toLowerCase() == value.toLowerCase() && d.user == target.id);
      if(!find) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.language.titles.error, this.client.language.service.no_review, this.client.embeds.error_color )], flags: this.client.cmdConfig.edit.ephemeral ? MessageFlags.Ephemeral : 0 });
  
      data = data.filter((d) => d != find);
      await this.client.database.usersData().set(`${target.id}.reviews`, data);
    } else if(action.toLowerCase() == "addbalance") {
      await this.client.utils.serverLogs(this.client, {
        date: new Date().toLocaleString("en-GB"),
        author_id: interaction.user.id,
        author: interaction.user.username,
        user_id: target.id,
        user: target.username,
        channel_id: `${interaction.channel.id}`,
        channel_name: `${interaction.channel.name}`,
        ticketId: null,
        amount: Number(value),
        message: `balance_add`
      });
  
      await this.client.database.usersData().add(`${target.id}.balance`, Number(value));
    } else if(action.toLowerCase() == "removebalance") {
      await this.client.utils.serverLogs(this.client, {
        date: new Date().toLocaleString("en-GB"),
        author_id: interaction.user.id,
        author: interaction.user.username,
        user_id: target.id,
        user: target.username,
        channel_id: `${interaction.channel.id}`,
        channel_name: `${interaction.channel.name}`,
        ticketId: null,
        amount: Number(value),
        message: `balance_remove`
      });
  
      await this.client.database.usersData().sub(`${target.id}.balance`, Number(value));
    } else if(action.toLowerCase() == "commprice") {
      let commission = await this.client.database.ticketsData().get(`${target.id}.commission`);
      if(!commission || commission?.status == "NO_STATUS") return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.commission.not_commission, this.client.embeds.error_color)], flags: this.client.cmdConfig.edit.ephemeral ? MessageFlags.Ephemeral : 0 });

      commission.quoteList[0].price = Number(value) || Number(commission.quoteList[0].price);
      await this.client.database.ticketsData().set(`${interaction.channel.id}.commission`, commission);
      await target.send({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.price_edited.replace("<user>", interaction.user).replace("<currencySymbol>", this.client.config.general.currency_symbol).replace("<amount>", Number(value)), this.client.embeds.success_color)] });
    }
    interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.data_edited.replace("<target>", target), this.client.embeds.success_color)], flags: this.client.cmdConfig.edit.ephemeral ? MessageFlags.Ephemeral : 0 });
  }
};