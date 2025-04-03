const Command = require("../../structures/Command");
const Discord = require("discord.js");

module.exports = class Add extends Command {
	constructor(client) {
		super(client, {
			name: "add",
			description: client.cmdConfig.add.description,
			usage: client.cmdConfig.add.usage,
			permissions: client.cmdConfig.add.permissions,
      aliases: client.cmdConfig.add.aliases,
			category: "tickets",
			enabled: client.cmdConfig.add.enabled,
      slash: true,
      options: [{
        name: 'user',
        type: Discord.ApplicationCommandOptionType.User,
        description: "User to add to Ticket",
        required: true,
      }]
		});
	}
  
  async run(message, args) {
    let config = this.client.config;

    if (!await this.client.utils.isTicket(this.client, message.channel)) 
      return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.ticket.ticket_channel, this.client.embeds.error_color)] });
    let member = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
    
    if(!member) return message.channel.send({ embeds: [this.client.utils.usage(this.client, message, this.client.cmdConfig.add.usage)] });
    if(member.id == message.author.id) return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.general.cannot_self, this.client.embeds.error_color)] });
    
    message.guild.channels.cache.get(message.channel.id).permissionOverwrites.create(member.id, {ViewChannel: true, SendMessages: true});
    
    const added = new Discord.EmbedBuilder()
      .setTitle(this.client.embeds.title)
      .setDescription(this.client.language.ticket.user_added.replace("<user>", member.user.username))
      .setFooter({ text: this.client.embeds.footer, iconURL: this.client.user.displayAvatarURL({ dynamic: true }) })
      .setTimestamp()
      .setColor(this.client.embeds.success_color);

    const ticketData = await this.client.database.ticketsData().get(`${message.channel.id}.ticketData`) || {};

    await this.client.utils.serverLogs(this.client, {
      date: new Date().toLocaleString("en-GB"),
      author_id: message.author.id,
      author: message.author.username,
      user_id: member.id,
      user: member.user.username,
      channel_id: `${message.channel.id}`,
      channel_name: `${message.channel.name}`,
      ticketId: ticketData.id,
      message: `ticket_add`
    });
    
    message.channel.send({ embeds: [added] });
  }
  async slashRun(interaction, args) {
    let config = this.client.config;
    let member = interaction.options.getMember("user");

    if (!await this.client.utils.isTicket(this.client, interaction.channel)) 
      return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.ticket.ticket_channel, this.client.embeds.error_color)], flags: this.client.cmdConfig.add.ephemeral ? Discord.MessageFlags.Ephemeral : 0 });
    
    if(!member) return interaction.reply({ embeds: [this.client.utils.usage(this.client, interaction, this.client.cmdConfig.add.usage)], flags: this.client.cmdConfig.add.ephemeral ? Discord.MessageFlags.Ephemeral : 0 });
    if(member.id == interaction.user.id) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.general.cannot_self, this.client.embeds.error_color)], flags: this.client.cmdConfig.add.ephemeral ? Discord.MessageFlags.Ephemeral : 0 });

    interaction.guild.channels.cache.get(interaction.channel.id).permissionOverwrites.create(member.id, { ViewChannel: true, SendMessages: true });
    
    const added = new Discord.EmbedBuilder()
      .setTitle(this.client.embeds.title)
      .setDescription(this.client.language.ticket.user_added.replace("<user>", member.user.username))
      .setFooter({ text: this.client.embeds.footer, iconURL: this.client.user.displayAvatarURL({ dynamic: true }) })
      .setTimestamp()
      .setColor(this.client.embeds.success_color);

    const ticketData = await this.client.database.ticketsData().get(`${interaction.channel.id}.ticketData`) || {};

    await this.client.utils.serverLogs(this.client, {
      date: new Date().toLocaleString("en-GB"),
      author_id: interaction.user.id,
      author: interaction.user.username,
      user_id: member.id,
      user: member.user.username,
      channel_id: `${interaction.channel.id}`,
      channel_name: `${interaction.channel.name}`,
      ticketId: ticketData.id,
      message: `ticket_add`
    });
    
    interaction.reply({ embeds: [added], flags: this.client.cmdConfig.add.ephemeral ? Discord.MessageFlags.Ephemeral : 0 });
  }
};