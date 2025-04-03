const Event = require("../../structures/Events");
const Discord = require("discord.js");
const chalk = require("chalk");
const { channelRoleCheck, filesCheck, databaseChecks } = require("../../utils/utils.js");
const { htmlTranscript } = require("../../utils/createTranscript.js");
const cron = require("cron");

module.exports = class Ready extends Event {
	constructor(client) {
	  super(client, "ready");
		this.client = client;
	}

	async run() {
		const config = this.client.config;
		let error = false;
		let foundErrors = [];
		let foundWarn = [];
		let usedGuild = this.client.guilds.cache.get(config.general.guild);
		if(!this.client.config.general.guild || !usedGuild) {
			error = true;
			this.client.utils.sendError(" ");
			this.client.utils.sendError("Config Field (general.guild) contains invalid Guild ID.");
			this.client.utils.sendError("or bot hasn't been invited to the server.");
			this.client.utils.sendError(" ");
			console.log(" ");
			foundErrors.push("Invalid Guild ID (general.guild)");
		}

		let guildData = await this.client.database.guildData().get(usedGuild.id) || {};

		if(!guildData && config.general.database.type == "mongo") {
			guildData = await this.client.database.guildData().createDefault(config.general.guild);
		}

		//== Look for Missing Directories and Files ==//
		filesCheck();

		//== Check NodeJS Version ==//
		let nodeVersion = process.version.replace("v", "");
		if(nodeVersion.split(".")[1].length == 1) nodeVersion = nodeVersion.split(".")[0] + ".0" + nodeVersion.split(".")[1];

		if(nodeVersion < "16.09" && !process.version.replace("v", "").includes("16.9")) {
		  error = true;
			this.client.utils.sendError(" ");
			this.client.utils.sendError("Detected NodeJS Version (" + process.version + ") but expected v16.9+. Please Upgrade your NodeJS Version.");
			this.client.utils.sendError(" ");
			foundErrors.push("UnSupported NodeJS Version");
		}
		
		//== Database Tasks for checking invalid data and similar ==//
		await databaseChecks(this.client, guildData);

		//== Look for Invalid Channel & Roles in Config ==//
		channelRoleCheck(this.client, usedGuild, foundWarn);

		let totalTickets = 0, currentTickets = 0;		
		if (usedGuild && config.general.guild != "") {
		  currentTickets = (await this.client.database.ticketsData().all()).length;
		  totalTickets = guildData.ticketCount || 0;

			this.client.otherCache.set('guild', {
				claimedTickets: guildData.claimedTickets || 0,
				ticketCount: guildData.ticketCount || 0,
				currentTickets,
			});
		}
		
		setInterval(async() => {
		  if (usedGuild && config.general.guild != "") {
				const updatedGuild = await this.client.database.guildData().get(`${this.client.config.general.guild}`) || {};

				currentTickets = (await this.client.database.ticketsData().all()).length;
				totalTickets = updatedGuild.ticketCount || 0;

				this.client.otherCache.set('guild', {
					claimedTickets: updatedGuild.claimedTickets || 0,
					ticketCount: totalTickets,
					currentTickets,
				});
		  }
		}, 240000);
		
		setInterval(() => {
			this.client.utils.updateStats(this.client, usedGuild);
		}, 185000);
		
		if(config.auto_announce.enabled == true) {
		  setInterval(() => {
		    const annRand = Math.floor(Math.random() * config.auto_announce.list.length);
  		  if (this.client.config.auto_announce.type == "EMBED") {
  		    let annEmbed = new Discord.EmbedBuilder()
  		      .setTitle(this.client.language.titles.auto_announce)
  		      .setColor(this.client.embeds.general_color)
						.setFooter({ text: this.client.embeds.footer, iconURL: this.client.user.displayAvatarURL({ dynamic: true }) })
						.setTimestamp()
  		      .setDescription(this.client.language.general.auto_announce.replace("<message>", this.client.config.auto_announce.list[annRand]));
  
					let annChannel = this.client.utils.findChannel(usedGuild, config.channels.announce);
  		    if(annChannel)
						annChannel.send({ embeds: [annEmbed] });
  		  } else if (this.client.config.auto_announce.type == "TEXT") {
  		    let annChannel = this.client.utils.findChannel(usedGuild, config.channels.announce);
  		    if(annChannel)
						annChannel.send({ content: this.client.config.auto_announce.list[annRand] });
  		  } else {
  		    this.client.utils.sendWarn("Invalid Message Type for Auto Announcements Message Provided.");
  		  }
		  }, config.auto_announce.interval * 1000);
		}
		
		if(config.status.change_random == true) {
			const rand = config.status.messages.length == 1 ? 0 : Math.floor(Math.random() * (config.status.messages.length));
      
			this.client.user.setActivity(config.status.messages[rand].replace("<members>", this.client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0))
			  .replace("<channels>", this.client.channels.cache.size)
			  .replace("<currentTickets>", currentTickets)
			  .replace("<totalTickets>", totalTickets), { type: Discord.ActivityType[config.status.type] });
			
			setInterval(() => {
				const index = config.status.messages.length == 1 ? 0 : Math.floor(Math.random() * (config.status.messages.length));
				this.client.user.setActivity(config.status.messages[index].replace("<members>", this.client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0))
				  .replace("<channels>", this.client.channels.cache.size)
			    .replace("<currentTickets>", currentTickets)
			    .replace("<totalTickets>", totalTickets), { type: Discord.ActivityType[config.status.type] });
			}, config.status.interval * 1000);
		} else {
			this.client.user.setActivity(this.client.config.status.message.replace("<members>", this.client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0))
			  .replace("<channels>", this.client.channels.cache.size)
			  .replace("<currentTickets>", currentTickets)
			  .replace("<totalTickets>", totalTickets), { type: Discord.ActivityType[config.status.type] });
		}

 		let dailyCron = new cron.CronJob("00 59 00 * * *", async() => {
			//== Check for inactive Tickets ==//
			if(this.client.config.tickets.inactivity_check == true) {
				const allTickets = (await this.client.database.ticketsData().all());
				allTickets.forEach(async(x, i) => {
					setTimeout(async() => {
						const channel = usedGuild.channels.cache.get(x.id);

						let lastMessage = await channel.messages.fetch(channel.lastMessageId).catch((err) => { });
						if(lastMessage?.createdTimestamp) {
							let lastMessageDate = new Date(lastMessage.createdTimestamp);
							const dateDifference = new Date().getTime() - lastMessageDate.getTime();
							const timePassed = Math.floor(dateDifference / 1000 / 60 / 60);
		
							if(timePassed > this.client.config.tickets.inactivity_time) {
								const ticketMember = usedGuild.members.cache.get(x.value.ticketData.owner ?? x.ticketData.owner);
								if(this.client.config.tickets.transcripts == true && ticketMember) await htmlTranscript(this.client, channel, ticketMember, "Ticket Inactive");
								else await channel.delete().catch((e) => { });
							}
						}
					}, 550 * i);
				});
			}

			if(this.client.config.server.dashboard.home.chart.enabled == true) {
				const dayStats = await this.client.database.guildData().get(this.client.config.general.guild);

				let lastDayStats = dayStats?.todayStats || [];
				let weeklyStats = dayStats?.weekStats || [];
				let today = new Date();
	
				weeklyStats[today.getDay() - 1] = {
					open: lastDayStats.filter((a) => a.action == "OPEN")?.length,
					close: lastDayStats.filter((a) => a.action == "CLOSE")?.length,
					join: lastDayStats.filter((a) => a.action == "JOIN")?.length,
					leave: lastDayStats.filter((a) => a.action == "LEAVE")?.length
				};
				weeklyStats = weeklyStats.map((w) => w == null ? { open: 0, close: 0 } : w);
				
				await this.client.database.guildData().set(`${this.client.config.general.guild}.weekStats`, weeklyStats);
				await this.client.database.guildData().delete(`${this.client.config.general.guild}.todayStats`);
	
				let weeklyCheck = await this.client.database.guildData().get(`${this.client.config.general.guild}.weekStats`)
				if(new Date().getDay() == 1) {
					weeklyCheck = [weeklyCheck[0]];
					await this.client.database.guildData().set(`${this.client.config.general.guild}.weekStats`, weeklyCheck);
				}
			}
		}, {
			timezone: this.client.config.general.timezone,
		}).start();

    if(this.client.config.general.slash == true) {
			try {
				let oldCommands = await this.client.guilds.cache.get(this.client.config.general.guild).commands.fetch();
				oldCommands = Array.from(oldCommands).map((x) => {
					return {
						name: x[1].name,
						description: x[1].description,
						options: x[1].options ?? [],
					}
				}).sort((a, b) => b.name - a.name);

				const newCommands = JSON.stringify(this.client.slashArray.map((x) => {
					return {
						name: x.name,
						description: x.description,
						options: x.options ?? [],
					}
				}).sort((a, b) => b.name - a.name));

				if(oldCommands != newCommands) await this.client.guilds.cache.get(this.client.config.general.guild).commands.set(this.client.slashArray); 
				// await this.client.application.commands.set([]);
			} catch(e) {
				console.log(e)
				error = true;
				if(!foundErrors.includes("Invalid Guild ID")) {
					this.client.utils.sendError("Bot haven't been invited with applications.commands scope. Please ReInvite Bot with Required Scope(s).");
					foundErrors.push("Invalid Scopes");
				}
			}
    } else {
			try {
				await this.client.guilds.cache.get(this.client.config.general.guild).commands.set([]);
				// await this.client.application.commands.set([]);
			} catch(e) {
				error = true;
				if(!foundErrors.includes("Invalid Guild ID")) {
					this.client.utils.sendError("Bot haven't been invited with applications.commands scope. Please ReInvite Bot with Required Scope(s).");
					foundErrors.push("Invalid Scopes");
				}
			}
    }

		//== Set Bot's Status ==//		
		this.client.user.setStatus(config.status.presence_status?.toLowerCase() || "online");

		if(error || foundErrors.length > 0) {
			console.log("");
			console.log(chalk.gray("▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃"));
			console.log("")
			console.log(chalk.red.bold(`${config.general.name.toUpperCase()} ${config.version.toUpperCase()}`));
			console.log("");
			console.log(chalk.white(`There was an error while starting bot, please look above for detailed error.`));
			console.log(chalk.white(`Bot should be online if it's not an important error.`));
			console.log("");
			console.log(chalk.red(`Startup Errors (${foundErrors.length}): `) + chalk.white(foundErrors.join(", ").trim() + "."));
			console.log("")
			console.log(chalk.gray("▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃"));
			console.log(" ");
		} else {
			let addons = chalk.greenBright(`Loaded Addons (${this.client.addonList.length}): `) + chalk.white(this.client.addonList.join(", ") + ".");
			let warns = chalk.keyword("orange")(`Startup Warnings (${foundWarn.length}): `) + chalk.white(foundWarn.join(", ").trim() + ".");
			
			console.log("");
			console.log(chalk.gray("▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃"));
			console.log("")
			console.log(chalk.blue.bold(`${config.general.name.toUpperCase()} ${config.version.toUpperCase()}`));
			console.log("");
			console.log(chalk.white(`Thank you for your purchase, bot has started and is online now!`));
			console.log("")
			console.log(this.client.addonList.length > 0 ? addons : "No Addons Loaded");
			console.log(foundWarn.length > 0 ? warns : "No Warnings or Errors on startup, good job!")
			console.log("")
			console.log(chalk.gray("▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃▃"));
			console.log(" ");
		}
	}
};
