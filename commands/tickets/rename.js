const Command = require("../../structures/Command");
const Discord = require("discord.js");

module.exports = class Rename extends Command {
	constructor(client) {
		super(client, {
			name: "rename",
			description: client.cmdConfig.rename.description,
			usage: client.cmdConfig.rename.usage,
			permissions: client.cmdConfig.rename.permissions,
      aliases: client.cmdConfig.rename.aliases,
			category: "tickets",
			enabled: client.cmdConfig.rename.enabled,
      slash: true,
      options: [{
        name: 'channel',
        type: Discord.ApplicationCommandOptionType.Channel,
        description: "Channel to rename",
        required: true
      }, {
        name: 'name',
        type: Discord.ApplicationCommandOptionType.String,
        description: "New name of channel, placeholders: <username>, <ticket>",
        required: true,
      }]
		});
	}
  
  async run(message, args) {
    let config = this.client.config;
    const channel = message.mentions.channels.first();
    const name = args[1];

    if(!channel || !name) return message.channel.send({ embeds: [this.client.utils.usage(this.client, message, this.client.cmdConfig.rename.usage)] });
    if (!await this.client.utils.isTicket(this.client, channel)) 
      return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.ticket.not_ticket, this.client.embeds.error_color)] });
    
    const ticketData = await this.client.database.ticketsData().get(`${channel.id}.ticketData`) || {};
    const ticketOwner = this.client.users.cache.get(ticketData.owner);

    message.guild.channels.cache.get(channel.id).edit({ name: this.client.utils.ticketPlaceholders(name, ticketOwner, ticketData.id) });
    
    message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.ticket.ticket_renamed.replace("<channel>", channel).replace("<name>", name).replace("<username>", ticketOwner.username).replace("<ticket>", ticketData.id), this.client.embeds.success_color)] });
  }
  async slashRun(interaction, args) {
    let config = this.client.config;
    const channel = interaction.options.getChannel("channel");
    const name = interaction.options.getString("name");

    if(!channel || !name) return interaction.reply({ embeds: [this.client.utils.usage(this.client, message, this.client.cmdConfig.rename.usage)], flags: this.client.cmdConfig.rename.ephemeral ? Discord.MessageFlags.Ephemeral : 0 });
    if (!await this.client.utils.isTicket(this.client, channel)) 
      return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.ticket.not_ticket, this.client.embeds.error_color)], flags: this.client.cmdConfig.rename.ephemeral ? Discord.MessageFlags.Ephemeral : 0 });
    
    const ticketData = await this.client.database.ticketsData().get(`${channel.id}.ticketData`) || {};
    const ticketOwner = this.client.users.cache.get(ticketData.owner);

    interaction.guild.channels.cache.get(channel.id).edit({ name: this.client.utils.ticketPlaceholders(name, ticketOwner, ticketData.id) });
    
    interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.ticket.ticket_renamed.replace("<channel>", channel).replace("<name>", name).replace("<username>", ticketOwner.username).replace("<ticket>", ticketData.id), this.client.embeds.success_color)], flags: this.client.cmdConfig.rename.ephemeral ? Discord.MessageFlags.Ephemeral : 0 });
  }
};