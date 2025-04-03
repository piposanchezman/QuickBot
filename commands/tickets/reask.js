const Command = require("../../structures/Command");
const Discord = require("discord.js");
const { chatAskQuestions } = require("../../utils/askQuestions");

module.exports = class Reask extends Command {
	constructor(client) {
		super(client, {
			name: "reask",
			description: client.cmdConfig.reask.description,
			usage: client.cmdConfig.reask.usage,
			permissions: client.cmdConfig.reask.permissions,
      aliases: client.cmdConfig.reask.aliases,
			category: "tickets",
			enabled: client.cmdConfig.reask.enabled,
			slash: true,
		});
	}
  
  async run(message, args) {
		const channelData = await this.client.database.ticketsData().get(`${message.channel.id}`) || {};
		const commissionId = await this.client.database.guildData().get(`${this.client.config.general.guild}.commissionCount`) || 0;

    const ticketData = channelData.ticketData;
    const commissionMsg = channelData.commission;
		const listOfQuestions = channelData.listOfQuestions;
		const questionsAnswered = channelData.listOfAnswers;
		
		if (!await this.client.utils.isTicket(this.client, message.channel)) 
			return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.ticket.ticket_channel, this.client.embeds.error_color)] });
		
 		if(!listOfQuestions || !questionsAnswered || questionsAnswered?.length == 0)
			return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.ticket.not_answered, this.client.embeds.error_color)] });
		
    const ticketOwner = message.guild.members.cache.get(ticketData?.owner);

    if(commissionMsg && commissionMsg?.commChannelId) {
			const commissionsChannel = this.client.utils.findChannel(message.guild, commissionMsg.commChannelId);
			const commFetchedMsg = await commissionsChannel.messages.fetch({ message: commissionMsg.commMessageId });
			
			if(commFetchedMsg.hasThread) {
				await commFetchedMsg.thread.delete().catch((err) => {})
			}

			if(commFetchedMsg) await commFetchedMsg.delete();
		} else if(commissionMsg && !commissionMsg?.commChannelId) {
			const commissionsChannel = this.client.utils.findChannel(message.guild, this.client.config.channels.commissions);
			const commFetchedMsg = await commissionsChannel.messages.fetch({ message: commissionMsg.commMessageId });
			
			if(commFetchedMsg.hasThread) {
				await commFetchedMsg.thread.delete().catch((err) => {})
			}

			if(commFetchedMsg) await commFetchedMsg.delete();
		}

		if(commissionMsg) {
			let bulkArr = commissionMsg.quoteList.map((x) => x.messageId);
			await message.channel.bulkDelete(bulkArr).catch((err) => {});
	
			await this.client.database.ticketsData().set(`${message.channel.id}.commission`, {
				id: Number(commissionId) + 1,
				user: ticketOwner.id,
				commMessageId: null,
				commChannelId: null,
				quoteList: [],
				status: "NO_STATUS",
				date: new Date()
			});
		}

		await this.client.database.ticketsData().set(`${message.channel.id}.questionsAnswered`, false);
		await this.client.database.ticketsData().set(`${message.channel.id}.listOfAnswers`, []);

		message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.ticket.reask, this.client.embeds.general_color)] });

		if(this.client.config.tickets.questions_type == "MODAL") {
			const firstMessage = (await message.channel.messages.fetch({ after: 1, limit: 1 })).first();
			let editActionRow = Discord.ActionRowBuilder.from(firstMessage.components[0]);

			editActionRow.components.forEach((c) => {
				if(c.data.custom_id != "closeTicket" && c.data.custom_id != "claimTicket") c.setStyle(Discord.ButtonStyle.Success)
					.setLabel(this.client.language.buttons.answer_questions.replace("<page>", "1"))
					.setDisabled(false);
			});

			await message.channel.threads.cache.first().delete();

			firstMessage.edit({ embeds: [firstMessage.embeds[0]], components: [editActionRow] })
		} else {
			await message.channel.threads.cache.first().delete();
			await chatAskQuestions(this.client, ticketOwner, message.channel, listOfQuestions.list, listOfQuestions.ticketCategory);
		}
  }
	async slashRun(interaction, args) {
		const channelData = await this.client.database.ticketsData().get(`${interaction.channel.id}`) || {};
		const commissionId = await this.client.database.guildData().get(`${this.client.config.general.guild}.commissionCount`) || 0;

    const ticketData = channelData.ticketData;
    const commissionMsg = channelData.commission;
		const listOfQuestions = channelData.listOfQuestions;
		const questionsAnswered = channelData.listOfAnswers;
		
		if (!await this.client.utils.isTicket(this.client, interaction.channel)) 
			return interaction.channel.send({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.ticket.ticket_channel, this.client.embeds.error_color)] });
		
 		if(!listOfQuestions || !questionsAnswered || questionsAnswered?.length == 0)
			return interaction.channel.send({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.ticket.not_answered, this.client.embeds.error_color)] });
		
    const ticketOwner = interaction.guild.members.cache.get(ticketData?.owner);

    if(commissionMsg && commissionMsg?.commChannelId) {
			const commissionsChannel = this.client.utils.findChannel(interaction.guild, commissionMsg.commChannelId);
			const commFetchedMsg = await commissionsChannel.messages.fetch({ message: commissionMsg.commMessageId });

			if(commFetchedMsg.hasThread) {
				await commFetchedMsg.thread.delete().catch((err) => {})
			}

			if(commFetchedMsg) await commFetchedMsg.delete();
		} else if(commissionMsg && !commissionMsg?.commChannelId) {
			const commissionsChannel = this.client.utils.findChannel(interaction.guild, this.client.config.channels.commissions);
			const commFetchedMsg = await commissionsChannel.messages.fetch({ message: commissionMsg.commMessageId });

			if(commFetchedMsg.hasThread) {
				await commFetchedMsg.thread.delete().catch((err) => {})
			}

			if(commFetchedMsg) await commFetchedMsg.delete();
		}

		if(commissionMsg) {
			let bulkArr = commissionMsg.quoteList.map((x) => x.messageId);
			await interaction.channel.bulkDelete(bulkArr).catch((err) => {});
	
			await this.client.database.ticketsData().set(`${interaction.channel.id}.commission`, {
				id: Number(commissionId) + 1,
				user: ticketOwner.id,
				commMessageId: null,
				commChannelId: null,
				quoteList: [],
				status: "NO_STATUS",
				date: new Date()
			});
		}

		await this.client.database.ticketsData().set(`${interaction.channel.id}.questionsAnswered`, false);
		await this.client.database.ticketsData().set(`${interaction.channel.id}.listOfAnswers`, []);

		interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.ticket.reask, this.client.embeds.general_color)], flags: this.client.cmdConfig.reask.ephemeral ? Discord.MessageFlags.Ephemeral : 0 });

		if(this.client.config.tickets.questions_type == "MODAL") {
			const firstMessage = (await interaction.channel.messages.fetch({ after: 1, limit: 1 })).first();
			let editActionRow = Discord.ActionRowBuilder.from(firstMessage.components[0]);

			editActionRow.components.forEach((c) => {
				if(c.data.custom_id != "closeTicket" && c.data.custom_id != "claimTicket") c.setStyle(Discord.ButtonStyle.Success)
					.setLabel(this.client.language.buttons.answer_questions.replace("<page>", "1"))
					.setDisabled(false);
			});

			await interaction.channel.threads.cache.first().delete();

			firstMessage.edit({ embeds: [firstMessage.embeds[0]], components: [editActionRow] })
		} else {
			await interaction.channel.threads.cache.first().delete();
			await chatAskQuestions(this.client, ticketOwner, interaction.channel, listOfQuestions.list, listOfQuestions.ticketCategory);
		}
	}
};