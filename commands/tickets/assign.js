const Command = require("../../structures/Command");
const { ApplicationCommandOptionType, MessageFlags } = require("discord.js");

module.exports = class Assign extends Command {
	constructor(client) {
		super(client, {
			name: "assign",
			description: client.cmdConfig.assign.description,
			usage: client.cmdConfig.assign.usage,
			permissions: client.cmdConfig.assign.permissions,
      aliases: client.cmdConfig.assign.aliases,
			category: "tickets",
			enabled: client.cmdConfig.assign.enabled,
			slash: true,
      options: [{
        name: "user",
        type: ApplicationCommandOptionType.User,
        description: "User to assign role to",
        required: true
      }]
		});
	}
  
  async run(message, args) {
    let config = this.client.config;
    let user = message.mentions.users.first() || this.client.users.cache.get(args[0]);
    let claimed = await this.client.database.ticketsData().get(`${message.channel.id}.ticketClaimed`);

    if(!user) return message.channel.send({ embeds: [this.client.utils.usage(this.client, message, this.client.cmdConfig.assign.usage)] });

    if (!await this.client.utils.isTicket(this.client, message.channel)) 
      return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.ticket.ticket_channel, this.client.embeds.error_color)] });

    message.channel.permissionOverwrites.edit(user, {
      SendMessages: true,
      ViewChannel: true,
    });

    if(claimed) await this.client.database.usersData().sub(`${claimed}.claimedStats`, 1);
    await this.client.database.ticketsData().set(`${message.channel.id}.ticketClaimed`, user.id);
    await this.client.database.ticketsData().delete(`${message.channel.id}.autoClaim`);
    message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.ticket.ticket_assigned.replace("<user>", user.username).replace("<author>", message.author.username), this.client.embeds.success_color)] }).then(() => message.delete().catch((err) => {}));
  }
	async slashRun(interaction, args) {
    let config = this.client.config;
    let user = interaction.options.getUser("user")
    let claimed = await this.client.database.ticketsData().get(`${interaction.channel.id}.ticketClaimed`);

    if (!await this.client.utils.isTicket(this.client, interaction.channel)) 
      return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.ticket.ticket_channel, this.client.embeds.error_color)], flags: this.client.cmdConfig.assign.ephemeral ? MessageFlags.Ephemeral : 0 });

      interaction.channel.permissionOverwrites.edit(user, {
      SendMessages: true,
      ViewChannel: true,
    });

    if(claimed) await this.client.database.usersData().sub(`${claimed}.claimedStats`, 1);
    await this.client.database.ticketsData().set(`${interaction.channel.id}.ticketClaimed`, user.id);
    await this.client.database.ticketsData().delete(`${interaction.channel.id}.autoClaim`);
    interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.ticket.ticket_assigned.replace("<user>", user.username).replace("<author>", interaction.user.username), this.client.embeds.success_color)], flags: this.client.cmdConfig.assign.ephemeral ? MessageFlags.Ephemeral : 0 });
	}
};