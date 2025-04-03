const Event = require("../../structures/Events");

module.exports = class ChannelDelete extends Event {
	constructor(...args) {
		super(...args);
	}

	async run(channel) {
    if(!channel.guild) return;
	  if(!channel.guild.members.me.permissions.has("ManageGuild")) return;

		const channelData = await this.client.database.ticketsData().get(`${channel.id}`);
		if(channelData?.ticketData) {
    	await this.client.database.usersData().delete(`${channelData.ticketData.owner}.choosingCategory`);
		}

		if(!channelData) return;
		const commissionMsg = channelData?.commission;
		if(commissionMsg && commissionMsg?.commChannelId) {
			const commissionsChannel = this.client.utils.findChannel(channel.guild, commissionMsg.commChannelId);
			const commFetchedMsg = await commissionsChannel.messages.fetch({ message: commissionMsg.commMessageId }).catch((err) => {});
			const commFetchedThread = await commissionsChannel.threads.cache.get(commissionMsg?.commThreadId);

			if(commFetchedThread)
				await commFetchedThread.delete().catch((err) => {});

			if(commFetchedMsg) await commFetchedMsg.delete();
		} else if(commissionMsg && !commissionMsg?.commChannelId) {
			const commissionsChannel = this.client.utils.findChannel(channel.guild, this.client.config.channels.commissions);
			const commFetchedMsg = await commissionsChannel.messages.fetch({ message: commissionMsg.commMessageId }).catch((err) => {});
			const commFetchedThread = await commissionsChannel.threads.cache.get(commissionMsg?.commThreadId);

			if(commFetchedThread)
				await commFetchedThread.delete().catch((err) => {});

			if(commFetchedMsg) await commFetchedMsg.delete();
		}

		await this.client.database.ticketsData().delete(`${channel.id}`);
	} 
};