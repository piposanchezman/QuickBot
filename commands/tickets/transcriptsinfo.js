const Command = require("../../structures/Command");
const { ApplicationCommandOptionType, MessageFlags } = require("discord.js");

module.exports = class TranscriptsInfo extends Command {
	constructor(client) {
		super(client, {
			name: "transcriptsinfo",
			description: client.cmdConfig.transcriptsinfo.description,
			usage: client.cmdConfig.transcriptsinfo.usage,
			permissions: client.cmdConfig.transcriptsinfo.permissions,
      aliases: client.cmdConfig.transcriptsinfo.aliases,
			category: "tickets",
			enabled: client.cmdConfig.transcriptsinfo.enabled,
			slash: true,
      options: [{
        name: "id",
        type: ApplicationCommandOptionType.String,
        description: "ID of User/Ticket related to transcript",
        required: true
      }]
		});
	}
  
  async run(message, args) {
    let id = args[0];
    
    if(!id) return message.channel.send({ embeds: [this.client.utils.usage(this.client, message, this.client.cmdConfig.transcriptsinfo.usage)] });

    let allTranscripts = (await this.client.database.transcriptsData().all());
    let findTranscripts = allTranscripts.filter((t) => ((t.owner == id) || (t.value.owner == id)) || t.id == id);

    if(findTranscripts.length == 0)
      return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.ticket.no_transcript_found.replace("<id>", id), this.client.embeds.general_color)] });

    findTranscripts = findTranscripts.map((x) => {
      const transcriptData = x.value ?? x;
      const user = this.client.users.cache.get(transcriptData.owner)?.username || (transcriptData.owner ? transcriptData.owner : "N/A");
      return this.client.config.tickets.transcripts_list_format
        .replace("<id>", x.id)
        .replace("<code>", transcriptData.code)
        .replace("<owner>", user)
        .replace("<date>", transcriptData.date ? `<t:${Math.round(new Date(transcriptData.date).getTime()/1000)}:F>` : "N/A")
    }).join("\n");

    message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.ticket.transcripts_list.replace("<id>", id).replace("<transcripts>", findTranscripts), this.client.embeds.general_color)] });
  }
	async slashRun(interaction, args) {
    let id = interaction.options.getString("id");
    
    let allTranscripts = (await this.client.database.transcriptsData().all());
    let findTranscripts = allTranscripts.filter((t) => ((t.owner == id) || (t.value.owner == id)) || t.id == id);

    if(findTranscripts.length == 0)
      return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.ticket.no_transcript_found.replace("<id>", id), this.client.embeds.general_color)], flags: this.client.cmdConfig.transcriptsinfo.ephemeral ? MessageFlags.Ephemeral : 0 });

    findTranscripts = findTranscripts.map((x) => {
      const transcriptData = x.value ?? x;
      const user = this.client.users.cache.get(transcriptData.owner)?.username || (transcriptData.owner ? transcriptData.owner : "N/A");
      return this.client.config.tickets.transcripts_list_format
        .replace("<id>", x.id)
        .replace("<code>", transcriptData.code)
        .replace("<owner>", user)
        .replace("<date>", transcriptData.date ? `<t:${Math.round(new Date(transcriptData.date).getTime()/1000)}:F>` : "N/A")
    }).join("\n");

    interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.ticket.transcripts_list.replace("<id>", id).replace("<transcripts>", findTranscripts), this.client.embeds.general_color)], flags: this.client.cmdConfig.transcriptsinfo.ephemeral ? MessageFlags.Ephemeral : 0 });
	}
};