const Command = require("../../structures/Command");
const { ApplicationCommandOptionType, EmbedBuilder } = require("discord.js");
const { textTranscript, htmlTranscript } = require("../../utils/createTranscript.js");
const askReview = require("../../utils/askReview.js");

module.exports = class Close extends Command {
	constructor(client) {
		super(client, {
			name: "close",
			description: client.cmdConfig.close.description,
			usage: client.cmdConfig.close.usage,
			permissions: client.cmdConfig.close.permissions,
			aliases: client.cmdConfig.close.aliases,
			category: "tickets",
			enabled: client.cmdConfig.close.enabled,
			slash: true,
			options: [{
				name: "reason",
				description: "Reason for closing ticket",
				type: ApplicationCommandOptionType.String,
				required: false
			}]
		});
	}
  
  async run(message, args) {
    const config = this.client.config;
		const language = this.client.language;

    if (!await this.client.utils.isTicket(this.client, message.channel)) 
      return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.ticket.ticket_channel, this.client.embeds.error_color)] });

		let reason = args[0] ? args.join(' ') : "";

		if(config.tickets.confirm_close == false) {
			message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.member.user, this.client.embeds.title, language.ticket.ticket_deleted, this.client.embeds.general_color)] });
			await askReview(this.client, message.channel, message.guild);

			let ticketData = await this.client.database.ticketsData().get(`${message.channel.id}.ticketData`);
			let memberTickets = await this.client.database.usersData().get(`${ticketData?.owner}.tickets`) || [];
			memberTickets = memberTickets.filter((x) => x.channel != message.channel.id);

			await this.client.utils.serverLogs(this.client, {
				date: new Date().toLocaleString("en-GB"),
				author_id: message.author.id,
				author: message.author.username,
				user_id: null,
				user: null,
				channel_id: `${message.channel.id}`,
				channel_name: `${message.channel.name}`,
				ticketId: ticketData.id,
				message: `ticket_close`
			});

			let canRename = await this.client.utils.canEditName(message.guild, message.channel);
			let ticketOwner = this.client.users.cache.get(ticketData?.owner);
			if(this.client.config.tickets.rename_close == true && canRename == true && ticketOwner 
					&& !message.channel.name.includes(this.client.config.channels.priority_name.replace("<priority>", ""))) {
				message.channel.setName(this.client.utils.ticketPlaceholders(config.channels.closed_name, ticketOwner, ticketData.id)).catch((e) => this.client.utils.sendWarn("Bot cannot rename this channel at the moment."));
			}

			await this.client.database.usersData().set(`${ticketData?.owner}.tickets`, memberTickets);
			await this.client.database.usersData().delete(`${ticketData?.owner}.choosingCategory`);
			if(this.client.config.server.dashboard.home.chart.save_close == true)
				await this.client.database.guildData().push(`${this.client.config.general.guild}.${this.client.config.general.guild}.todayStats`, { action: "CLOSE" });

			if(this.client.config.tickets.dm_author == true && ticketOwner && message.author.id != ticketOwner?.id) {
				let dmUserEmbed = new EmbedBuilder()
					.setColor(this.client.embeds.ticket_close_dm.color);
				
				if(this.client.embeds.ticket_close_dm.title) dmUserEmbed.setTitle(this.client.embeds.ticket_close_dm.title);
				let field = this.client.embeds.ticket_close_dm.fields;
				for(let i = 0; i < this.client.embeds.ticket_close_dm.fields.length; i++) {
					dmUserEmbed.addFields([{ name: field[i].title, value: field[i].description.replace("<author>", `${ticketOwner.username}`)
						.replace("<authorId>", `${ticketOwner.id}`)
						.replace("<reason>", `${reason || "N/A"}`)
						.replace("<ticketId>", `${ticketData.id}`)
						.replace("<closedBy>", `${message.author.username}`)
						.replace("<closedById>", `${message.author.id}`)
						.replace("<channel>", `${message.channel.name}`), inline: this.client.embeds.ticket_close_dm.inline }]);
				}
				
				if(this.client.embeds.ticket_close_dm.footer == true) dmUserEmbed.setFooter({ text: message.author.username, iconURL: message.author.displayAvatarURL({ size: 1024, dynamic: true }) }).setTimestamp();
				if(this.client.embeds.ticket_close_dm.thumbnail == true) dmUserEmbed.setThumbnail(message.author.displayAvatarURL({ dynamic: true }));
				
				if(this.client.embeds.ticket_close_dm.description) dmUserEmbed.setDescription(this.client.embeds.ticket_close_dm.description.replace("<author>", `${ticketOwner.username}`)
					.replace("<authorId>", `${ticketOwner.id}`)
					.replace("<reason>", `${reason || "N/A"}`)
					.replace("<ticketId>", `${ticketData.id}`)
					.replace("<closedBy>", `${message.author.username}`)
					.replace("<closedById>", `${message.author.id}`)
					.replace("<channel>", `${message.channel.name}`));
	
				ticketOwner.send({ embeds: [dmUserEmbed] }).catch((err) => {
					console.error("User's DM Closed");
				});
			}

			if(config.tickets.transcripts == true) {
				if(config.tickets.transcript_type == "HTML") {
					await htmlTranscript(this.client, message.channel, message.member, reason);
				} else {
					await textTranscript(this.client, message.channel, message.member, reason);
				}
			} else {
				await this.client.database.ticketsData().delete(`${message.channel.id}`);
				setTimeout(async() => {
					message.channel.delete();
				}, this.client.config.tickets.delete_after * 1000);
			}
			return;
		}
  
    this.client.emit("ticketClose", message, message.member, reason);
  }
	async slashRun(interaction, args) {
		const config = this.client.config;
		const language = this.client.language;

    if (!await this.client.utils.isTicket(this.client, interaction.channel)) 
      return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.ticket.ticket_channel, this.client.embeds.error_color)] });

		let reason = interaction.options?.getString("reason") || "No Reason";

		if(config.tickets.confirm_close == false) {
			interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, language.ticket.ticket_deleted, this.client.embeds.general_color)] });
			await askReview(this.client, interaction.channel, interaction.guild);
			
			let ticketData = await this.client.database.ticketsData().get(`${interaction.channel.id}.ticketData`);
			let memberTickets = await this.client.database.usersData().get(`${ticketData?.owner}.tickets`) || [];
			memberTickets = memberTickets.filter((x) => x.channel != interaction.channel.id);

			await this.client.utils.serverLogs(this.client, {
				date: new Date().toLocaleString("en-GB"),
				author_id: interaction.user.id,
				author: interaction.user.username,
				user_id: null,
				user: null,
				channel_id: `${interaction.channel.id}`,
				channel_name: `${interaction.channel.name}`,
				ticketId: ticketData.id,
				message: `ticket_close`
			});

			let canRename = await this.client.utils.canEditName(interaction.guild, interaction.channel);
			let ticketOwner = this.client.users.cache.get(ticketData?.owner);
			if(this.client.config.tickets.rename_close == true && canRename == true && ticketOwner
					&& !interaction.channel.name.includes(this.client.config.channels.priority_name.replace("<priority>", ""))) {
				interaction.channel.setName(this.client.utils.ticketPlaceholders(config.channels.closed_name, ticketOwner, ticketData.id)).catch((e) => this.client.utils.sendWarn("Bot cannot rename this channel at the moment."));
			}

			await this.client.database.usersData().set(`${ticketData?.owner}.tickets`, memberTickets);
			await this.client.database.usersData().delete(`${ticketData?.owner}.choosingCategory`);
			if(this.client.config.server.dashboard.home.chart.save_close == true)
			await this.client.database.guildData().push(`${this.client.config.general.guild}.${this.client.config.general.guild}.todayStats`, { action: "CLOSE" });

			if(this.client.config.tickets.dm_author == true && ticketOwner && interaction.user.id != ticketOwner?.id) {
				let dmUserEmbed = new EmbedBuilder()
					.setColor(this.client.embeds.ticket_close_dm.color);
				
				if(this.client.embeds.ticket_close_dm.title) dmUserEmbed.setTitle(this.client.embeds.ticket_close_dm.title);
				let field = this.client.embeds.ticket_close_dm.fields;
				for(let i = 0; i < this.client.embeds.ticket_close_dm.fields.length; i++) {
					dmUserEmbed.addFields([{ name: field[i].title, value: field[i].description.replace("<author>", `${ticketOwner.username}`)
						.replace("<authorId>", `${ticketOwner.id}`)
						.replace("<reason>", `${reason || "N/A"}`)
						.replace("<ticketId>", `${ticketData.id}`)
						.replace("<closedBy>", `${interaction.user.username}`)
						.replace("<closedById>", `${interaction.user.id}`)
						.replace("<channel>", `${interaction.channel.name}`), inline: this.client.embeds.ticket_close_dm.inline }]);
				}
				
				if(this.client.embeds.ticket_close_dm.footer == true) dmUserEmbed.setFooter({ text: interaction.user.username, iconURL: interaction.user.displayAvatarURL({ size: 1024, dynamic: true }) }).setTimestamp();
				if(this.client.embeds.ticket_close_dm.thumbnail == true) dmUserEmbed.setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }));
				
				if(this.client.embeds.ticket_close_dm.description) dmUserEmbed.setDescription(this.client.embeds.ticket_close_dm.description.replace("<author>", `${ticketOwner.username}`)
					.replace("<reason>", `${reason || "N/A"}`)
					.replace("<ticketId>", `${ticketData.id}`)
					.replace("<closedBy>", `${interaction.user.username}`)
					.replace("<closedById>", `${interaction.user.id}`)
					.replace("<channel>", `${interaction.channel.name}`));
	
				ticketOwner.send({ embeds: [dmUserEmbed] }).catch((err) => {
					console.error("User's DM Closed");
				});
			}

			if(config.tickets.transcripts == true) {
				if(config.tickets.transcript_type == "HTML") {
					await htmlTranscript(this.client, interaction.channel, interaction.member, reason = "No Reason");
				} else {
					await textTranscript(this.client, interaction.channel, interaction.member, reason = "No Reason");
				}
			} else {
				//await askReview(this.client, message.channel, interaction.guild);
				await this.client.database.ticketsData().delete(`${interaction.channel.id}`);

				setTimeout(async() => {
					interaction.channel.delete();
				}, this.client.config.tickets.delete_after * 1000);
			}
			return;
		}
    this.client.emit("ticketClose", interaction, interaction.member, reason);
	}
};
