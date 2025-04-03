const Command = require("../../structures/Command");
const { MessageFlags } = require("discord.js");

module.exports = class Claim extends Command {
	constructor(client) {
		super(client, {
			name: "claim",
			description: client.cmdConfig.claim.description,
			usage: client.cmdConfig.claim.usage,
			permissions: client.cmdConfig.claim.permissions,
      aliases: client.cmdConfig.claim.aliases,
			category: "tickets",
			enabled: client.cmdConfig.claim.enabled,
			slash: true,
		});
	}
  
  async run(message, args) {
    let config = this.client.config;
    let claimed = await this.client.database.ticketsData().get(`${message.channel.id}.ticketClaimed`);
    let ticketData = await this.client.database.ticketsData().get(`${message.channel.id}.ticketData`);

    if (!await this.client.utils.isTicket(this.client, message.channel)) 
      return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.ticket.ticket_channel, this.client.embeds.error_color)] });

    if(claimed) 
      return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.ticket.already_claimed, this.client.embeds.error_color)] });

    let supportRolesPerms = message.channel.permissionOverwrites.cache.map((r) => {
      if(r.id != ticketData?.owner && r.id != message.member.user.id && r.id != message.guild.id && r.id != this.client.user.id)
        return {
          id: r.id,
          allow: ["ViewChannel"],
          deny: ["SendMessages"]
        };
    }).filter(Boolean);

    let claimPerms = [{
      id: message.guild.id,
      deny: ["SendMessages", "ViewChannel"]
    }, {
      id: ticketData?.owner,
      allow: ["SendMessages", "ViewChannel"]
    }, {
      id: message.member.id,
      allow: ["SendMessages", "ViewChannel"]
    }];

    claimPerms = claimPerms.concat(supportRolesPerms);

    await message.channel.permissionOverwrites.set(claimPerms);

    await this.client.database.ticketsData().set(`${message.channel.id}.ticketClaimed`, message.author.id);
    await this.client.database.guildData().add(`${this.client.config.general.guild}.claimedTickets`, 1);
    await this.client.database.usersData().add(`${message.author.id}.claimedStats`, 1);
    await this.client.database.ticketsData().delete(`${message.channel.id}.autoClaim`);
    message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.ticket.ticket_claimed.replace("<user>", message.author.username), this.client.embeds.success_color)] }).then(() => message.delete().catch((err) => {}));
  }
	async slashRun(interaction, args) {
    let config = this.client.config;
    let claimed = await this.client.database.ticketsData().get(`${interaction.channel.id}.ticketClaimed`);
    let ticketData = await this.client.database.ticketsData().get(`${interaction.channel.id}.ticketData`);

    if (!await this.client.utils.isTicket(this.client, interaction.channel)) 
      return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.ticket.ticket_channel, this.client.embeds.error_color)], flags: this.client.cmdConfig.claim.ephemeral ? MessageFlags.Ephemeral : 0 });

    if(claimed) 
      return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.ticket.already_claimed, this.client.embeds.error_color)], flags: this.client.cmdConfig.claim.ephemeral ? MessageFlags.Ephemeral : 0 });

    let supportRolesPerms = interaction.channel.permissionOverwrites.cache.map((r) => {
      if(r.id != ticketData?.owner && r.id != interaction.member.user.id && r.id != interaction.guild.id && r.id != this.client.user.id)
        return {
          id: r.id,
          allow: ["ViewChannel"],
          deny: ["SendMessages"]
        };
    }).filter(Boolean);

    let claimPerms = [{
      id: interaction.guild.id,
      deny: ["SendMessages", "ViewChannel"]
    }, {
      id: ticketData?.owner,
      allow: ["SendMessages", "ViewChannel"]
    }, {
      id: interaction.member.id,
      allow: ["SendMessages", "ViewChannel"]
    }];

    claimPerms = claimPerms.concat(supportRolesPerms);

    await interaction.channel.permissionOverwrites.set(claimPerms);

    await this.client.database.ticketsData().set(`${interaction.channel.id}.ticketClaimed`, interaction.user.id);
    await this.client.database.guildData().add(`${this.client.config.general.guild}.claimedTickets`, 1);
    await this.client.database.usersData().add(`${interaction.user.id}.claimedStats`, 1);
    await this.client.database.ticketsData().delete(`${interaction.channel.id}.autoClaim`);
    interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.ticket.ticket_claimed.replace("<user>", interaction.user.username), this.client.embeds.success_color)], flags: this.client.cmdConfig.claim.ephemeral ? MessageFlags.Ephemeral : 0 });
	}
};