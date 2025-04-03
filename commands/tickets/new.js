const Command = require("../../structures/Command");
const Discord = require("discord.js");

module.exports = class New extends Command {
	constructor(client) {
		super(client, {
			name: "new",
			description: client.cmdConfig.new.description,
			usage: client.cmdConfig.new.usage,
			permissions: client.cmdConfig.new.permissions,
      aliases: client.cmdConfig.new.aliases,
			category: "tickets",
			enabled: client.cmdConfig.new.enabled,
      slash: true,
      options: [{
        name: "reason",
        type: Discord.ApplicationCommandOptionType.String,
        description: "Reason for Ticket",
        required: false
      }]
		});
	}
  
  async run(message, args) {
    let config = this.client.config;
    let reason = args.slice(1).join(" ");
    
    let blackListed = false;
    for(let i = 0; i < config.roles.blacklist.length; i++) {
      if(message.member.roles.cache.has(config.roles.blacklist[i])) blackListed = true;
    }
    if(blackListed == true) 
      return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.ticket.bl_role, this.client.embeds.error_color)] });
    if(config.users.blacklist.includes(message.author.id))
      return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.ticket.bl_user, this.client.embeds.error_color)] });
    const noCategory = new Discord.EmbedBuilder()
      .setTitle(this.client.embeds.title)
      .setDescription(this.client.language.ticket.no_category)
      .setFooter({ text: this.client.embeds.footer, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
      .setTimestamp()
      .setColor(this.client.embeds.error_color);
    if(config.channels.tickets_category == "") 
      return message.channel.send({ embeds: [noCategory] });

    this.client.emit("ticketCreate", message, message.member, reason);
  }
  async slashRun(interaction, args) {
    let config = this.client.config;
    let reason = interaction.options.getString("reason");
    
    let blackListed = false;
    for(let i = 0; i < config.roles.blacklist.length; i++) {
      if(interaction.member.roles.cache.has(config.roles.blacklist[i])) blackListed = true;
    }
    if(blackListed == true) 
      return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.ticket.bl_role, this.client.embeds.error_color)] });
    if(config.users.blacklist.includes(interaction.user.id))
      return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.ticket.bl_user, this.client.embeds.error_color)] });
    const noCategory = new Discord.EmbedBuilder()
      .setTitle(this.client.embeds.title)
      .setDescription(this.client.language.ticket.no_category)
      .setFooter({ text: this.client.embeds.footer, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
      .setTimestamp()
      .setColor(this.client.embeds.error_color);
    if(config.channels.tickets_category == "") return interaction.channel.send({ embeds: [noCategory], flags: Discord.MessageFlags.Ephemeral });
    
    this.client.emit("ticketCreate", interaction, interaction.member, reason);
  }
};