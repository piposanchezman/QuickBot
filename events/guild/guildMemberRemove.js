const Discord = require("discord.js");
const Event = require("../../structures/Events");
const { htmlTranscript, textTranscript } = require("../../utils/createTranscript.js");

module.exports = class GuildMemberRemove extends Event {
	constructor(...args) {
		super(...args);
	}

	async run(member) {
	  let config = this.client.config;
    if(this.client.config.server.dashboard.home.chart.save_join == true) {
      await this.client.database.guildData().push(`${this.client.config.general.guild}.todayStats`, { action: "LEAVE" });
    }

    //== Remove data from Database ==//

    await this.client.database.usersData().delete(`${member.id}.choosingCategory`);

    if(this.client.config.tickets.remove_leave == true) {
      let ticketList = await this.client.database.usersData().get(`${member.id}.tickets`) || [];
      if(!ticketList || ticketList.length == 0) return;
      ticketList.forEach(async(x) => {
        const channel = member.guild.channels.cache.get(x.channel);
        if(config.tickets.transcript_type == "HTML") {
          await htmlTranscript(this.client, channel, member, "Member Left");
        } else {
          await textTranscript(this.client, channel, member, "Member Left");
        }
      });
    }
  }
};