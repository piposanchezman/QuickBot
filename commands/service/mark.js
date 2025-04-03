const Command = require("../../structures/Command");
const { ApplicationCommandOptionType, MessageFlags } = require("discord.js");

module.exports = class Mark extends Command {
  constructor(client) {
    super(client, {
      name: "mark",
      description: client.cmdConfig.mark.description,
      usage: client.cmdConfig.mark.usage,
      permissions: client.cmdConfig.mark.permissions,
      aliases: client.cmdConfig.mark.aliases,
      category: "service",
      enabled: client.cmdConfig.mark.enabled,
      slash: true,
      options: [{
        name: "status",
        description: "Change commission status",
        type: ApplicationCommandOptionType.String,
        required: true,
        choices: [
          {
            name: "Completed",
            value: "completed"
          }
        ]
      }]
    });
  }

  async run(message, args) {
    let status = args[0];
    let options = ["completed"];
    if(!status || !options.includes(status?.toLowerCase())) return message.channel.send({ embeds: [this.client.utils.usage(this.client, message, this.client.cmdConfig.mark.usage)] });
    let commission = await this.client.database.ticketsData().get(`${message.channel.id}.commission`);
    if(!commission) return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.service.commission.not_commission, this.client.embeds.error_color)] });

    if(status?.toLowerCase() == "completed") {
      if(commission.status != "QUOTE_ACCEPTED") return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.service.commission.no_quote, this.client.embeds.error_color)] });

      commission.status = "COMPLETED";
      await this.client.database.ticketsData().set(`${message.channel.id}.commission`, commission);

      let commissionPrice = Number(commission.quoteList[0].price);

      let countTax = Number(((commissionPrice * Number(this.client.config.general.commission_tax)) / 100).toFixed(2));

      message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.service.commission.marked.replace("<user>", message.author.username).replace("<status>", "COMPLETED"), this.client.embeds.success_color)] });

      if(this.client.config.general.add_balance == true) {
        await this.client.database.usersData().add(`${commission.quoteList[0].user}.balance`, countTax);
        message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.service.commission.complete.replace("<freelancer>", `<@!${commission.quoteList[0].user}>`).replace("<percentage>", this.client.config.general.commission_tax).replaceAll("<currency>", this.client.config.general.currency_symbol).replace("<fullAmount>", commissionPrice).replace("<taxAmount>", countTax), this.client.embeds.success_color)] });
      }

      const ticketData = await this.client.database.ticketsData().get(`${message.channel.id}.ticketData`) || {};

      await this.client.utils.serverLogs(this.client, {
        date: new Date().toLocaleString("en-GB"),
        author_id: message.author.id,
        author: message.author.username,
        user_id: null,
        user: null,
        channel_id: `${message.channel.id}`,
        channel_name: `${message.channel.name}`,
        ticketId: ticketData.id || "N/A",
        message: `mark_complete`
      });

      await this.client.database.guildData().add(`${this.client.config.general.guild}.totalIncome`, countTax);
      if(this.client.config.general.client_info == true) {
        const clientProfile = await this.client.database.usersData().get(`${commission.user}.clientProfile`) || await this.client.database.usersData().set(`${commission.user}.clientProfile`, {
          orderCount: 0,
          amountSpent: 0,
        });

        clientProfile.orderCount++;
        clientProfile.amountSpent += Number(commissionPrice);
        await this.client.database.usersData().set(`${commission.user}.clientProfile`, clientProfile);
      }
    }
  }
  async slashRun(interaction, args) {
    await interaction.deferReply({ flags: this.client.cmdConfig.mark.ephemeral ? MessageFlags.Ephemeral : 0 });
    let status = interaction.options.getString("status");

    let options = ["completed"];
    if(!options.includes(status?.toLowerCase())) return interaction.followUp({ embeds: [this.client.utils.usage(this.client, interaction, this.client.cmdConfig.mark.usage)] });
    let commission = await this.client.database.ticketsData().get(`${interaction.channel.id}.commission`);
    if(!commission) return interaction.followUp({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.commission.not_commission, this.client.embeds.error_color)], flags: this.client.cmdConfig.mark.ephemeral ? MessageFlags.Ephemeral : 0 });

    if(status == "completed") {
      if(commission.status != "QUOTE_ACCEPTED") return interaction.followUp({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.commission.no_quote, this.client.embeds.error_color)], flags: this.client.cmdConfig.mark.ephemeral ? MessageFlags.Ephemeral : 0 });

      commission.status = "COMPLETED";
      await this.client.database.ticketsData().set(`${interaction.channel.id}.commission`, commission);

      let commissionPrice = Number(commission.quoteList[0].price);

      let countTax = Number(((commissionPrice * Number(this.client.config.general.commission_tax)) / 100).toFixed(2));
      
      interaction.followUp({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.commission.marked.replace("<user>", interaction.user.username).replace("<status>", "COMPLETED"), this.client.embeds.success_color)], flags: this.client.cmdConfig.mark.ephemeral ? MessageFlags.Ephemeral : 0 });

      if(this.client.config.general.add_balance == true) {
        await this.client.database.usersData().add(`${commission.quoteList[0].user}.balance`, countTax);
        interaction.followUp({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.commission.complete.replace("<freelancer>", `<@!${commission.quoteList[0].user}>`).replace("<percentage>", this.client.config.general.commission_tax).replaceAll("<currency>", this.client.config.general.currency_symbol).replace("<fullAmount>", commissionPrice).replace("<taxAmount>", countTax), this.client.embeds.success_color)], flags: this.client.cmdConfig.mark.ephemeral ? MessageFlags.Ephemeral : 0 });
      }

      const ticketData = await this.client.database.ticketsData().get(`${interaction.channel.id}.ticketData`) || {};

      await this.client.utils.serverLogs(this.client, {
        date: new Date().toLocaleString("en-GB"),
        author_id: interaction.user.id,
        author: interaction.user.username,
        user_id: null,
        user: null,
        channel_id: `${interaction.channel.id}`,
        channel_name: `${interaction.channel.name}`,
        ticketId: ticketData.id || "N/A",
        message: `mark_complete`
      });

      await this.client.database.guildData().add(`${this.client.config.general.guild}.totalIncome`, countTax);
      if(this.client.config.general.client_info == true) {
        const clientProfile = await this.client.database.usersData().get(`${commission.user}.clientProfile`) || await this.client.database.usersData().set(`${commission.user}.clientProfile`, {
          orderCount: 0,
          amountSpent: 0,
        });

        clientProfile.orderCount++;
        clientProfile.amountSpent += Number(commissionPrice);
        await this.client.database.usersData().set(`${commission.user}.clientProfile`, clientProfile);
      }
    }
  }
};