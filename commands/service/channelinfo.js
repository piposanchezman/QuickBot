const Command = require("../../structures/Command");
const Discord = require("discord.js");

module.exports = class ChannelInfo extends Command {
  constructor(client) {
    super(client, {
      name: "channelinfo",
      description: client.cmdConfig.channelinfo.description,
      usage: client.cmdConfig.channelinfo.usage,
      permissions: client.cmdConfig.channelinfo.permissions,
      aliases: client.cmdConfig.channelinfo.aliases,
      category: "service",
      enabled: client.cmdConfig.channelinfo.enabled,
      slash: true
    });
  }

  async run(message, args) {
    if (!await this.client.utils.isTicket(this.client, message.channel)) 
      return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.ticket.ticket_channel, this.client.embeds.error_color)] });

    const channelData = await this.client.database.ticketsData().get(`${message.channel.id}`) || {};
    let ans = channelData.listOfAnswers || [{
      questionName: 'No Questions',
      question: 'No Questions',
      answer: 'No Answers'
    }];
    
    let notes = channelData.notes || 'No Notes';
    let claimed = channelData.ticketClaimed || "N/A";
    let ticketId = await this.client.database.guildData().get(`${this.client.config.general.guild}.ticketCount`);

    let embed = new Discord.EmbedBuilder()
      .setTitle(this.client.embeds.channel_info.title)
      .setColor(this.client.embeds.channel_info.color);

    if(this.client.embeds.channel_info.footer == true) embed.setFooter({ text: message.author.username, iconURL: message.author.displayAvatarURL({ dynamic: true }) }).setTimestamp();

    if(this.client.embeds.channel_info.questions == true) {
      for(let i = 0; i < ans.length; i++) {
        embed.addFields([{ name: ans[i].questionName, value: ans[i].answer == "" ? "N/A" : ans[i].answer }]);
      }
    }

    if(this.client.embeds.channel_info.fields.ticketId != "") embed.addFields([{ name: `${this.client.embeds.channel_info.fields.ticketId}`, value: `${ticketId}` }]);
    if(this.client.embeds.channel_info.fields.claimed != "") embed.addFields([{ name: `${this.client.embeds.channel_info.fields.claimed}`, value: `${claimed}` }]);
    embed.addFields([{ name: `${this.client.embeds.channel_info.fields.notes}`, value: `\`\`\`${notes}\`\`\`` }]);

    message.channel.send({ embeds: [embed] });
  }
  async slashRun(interaction, args) {
    if (!await this.client.utils.isTicket(this.client, interaction.channel)) 
      return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.ticket.ticket_channel, this.client.embeds.error_color)] });

    const channelData = await this.client.database.ticketsData().get(`${interaction.channel.id}`) || {};
    let ans = channelData.listOfAnswers || [{
      questionName: 'No Questions',
      question: 'No Questions',
      answer: 'No Answers'
    }];
    
    let notes = channelData.notes || 'No Notes';
    let claimed = channelData.ticketClaimed || "N/A";
    let ticketId = await this.client.database.guildData().get(`${this.client.config.general.guild}.ticketCount`);

    let embed = new Discord.EmbedBuilder()
      .setTitle(this.client.embeds.channel_info.title)
      .setColor(this.client.embeds.channel_info.color);

    if(this.client.embeds.channel_info.footer == true) embed.setFooter({ text: interaction.user.username, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) }).setTimestamp();
    
    if(this.client.embeds.channel_info.questions == true) {
      for(let i = 0; i < ans.length; i++) {
        embed.addFields([{ name: ans[i].questionName, value: ans[i].answer == "" ? "N/A" : ans[i].answer }]);
      }
    }

    if(this.client.embeds.channel_info.fields.ticketId != "") embed.addFields([{ name: `${this.client.embeds.channel_info.fields.ticketId}`, value: `${ticketId}` }]);
    if(this.client.embeds.channel_info.fields.claimed != "") embed.addFields([{ name: `${this.client.embeds.channel_info.fields.claimed}`, value: `${claimed}` }]);
    embed.addFields([{ name: `${this.client.embeds.channel_info.fields.notes}`, value: `\`\`\`${notes}\`\`\`` }]);

    interaction.reply({ embeds: [embed], flags: this.client.cmdConfig.channelinfo.ephemeral ? Discord.MessageFlags.Ephemeral : 0 });
  }
};
