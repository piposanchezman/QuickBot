const Discord = require("discord.js");
const Event = require("../../structures/Events");

module.exports = class GuildMemberAdd extends Event {
	constructor(...args) {
		super(...args);
	}

	async run(member) {
    if(this.client.config.server.dashboard.home.chart.save_join == true) {
      if(this.client.config.server.dashboard.home.chart.save_join == true)
        await this.client.database.guildData().push(`${this.client.config.general.guild}.todayStats`, { action: "JOIN" });
    }
  }
};