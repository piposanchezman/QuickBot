const Discord = require("discord.js");
const Event = require("../../structures/Events");

module.exports = class Message extends Event {
	constructor(...args) {
		super(...args);
	}

	async run(message) {
    if (message.channel.type === Discord.ChannelType.DM) return;
    let prefix = this.client.config.general.prefix;

    if (message.author.bot) return;

    if(this.client.config.auto_response.enabled == true) {
      if((Object.keys(this.client.config.auto_response.list).some(w => message.content.toLowerCase().includes(w.toLowerCase()) || message.content.toLowerCase().startsWith(w.toLowerCase()))) &&
        !this.client.autoResponse.get(message.channel.id)) {
        let rWord = Object.keys(this.client.config.auto_response.list).filter(w => Object.keys(this.client.config.auto_response.list).some(a => message.content.toLowerCase().includes(w.toLowerCase())));
        let respIndex = Object.keys(this.client.config.auto_response.list).indexOf(rWord[0]);
        
        let resp = Object.values(this.client.config.auto_response.list)[respIndex];
        
        this.client.autoResponse.set(message.channel.id, true);
        setTimeout(() => {
          this.client.autoResponse.delete(message.channel.id);
        }, this.client.config.auto_response.cooldown * 1000);

        if(this.client.config.auto_response.type == "EMBED") {
          let respEmbed = new Discord.EmbedBuilder()
            .setTitle(this.client.language.titles.auto_response)
            .setColor(this.client.embeds.general_color)
            .setFooter({ text: message.author.username, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
            .setTimestamp()
            .setDescription(this.client.language.general.auto_response.replace("<user>", message.author)
              .replace("<response>", resp));
            
          message.reply({ embeds: [respEmbed] });
        } else if(this.client.config.auto_response.type == "TEXT") {
          message.reply({ content: resp });
        } else {
          this.client.utils.sendError("Invalid Message Type for Auto Response Message Provided.");
        }
      } 
    }

    if(await this.client.utils.isTicket(this.client, message.channel)) {
      let channelData = await this.client.database.ticketsData().get(`${message.channel.id}`);
      if(channelData.ticketData?.openedAt != null && channelData.ticketData?.owner && channelData.ticketData?.owner != message.author.id && message.author.bot == false) {
        let userData = await this.client.database.usersData().get(`${message.author.id}`) || {};
        let opened = channelData.ticketData?.openedAt;
        let now = new Date();
        let creationDate = (new Date(opened).getTime());
        let started = creationDate || new Date().getTime();
        let timeDiff = now.getTime() - started;
  
        let recentResp = userData.recentResponse || [];
        recentResp.unshift(timeDiff);
        let totalResp = userData.totalResponse || [];
        totalResp.unshift(timeDiff);

        userData.recentResponse = recentResp;
        userData.totalResponse = totalResp;

        channelData.ticketData.openedAt = null;
        channelData.autoClaim = `${message.author.id}`;

        await this.client.database.usersData().set(`${message.author.id}`, userData);
        await this.client.database.ticketsData().set(`${message.channel.id}`, channelData);
      }
    }

    // <== Commands ==> //
    const prefixMention = new RegExp(`^<@!?${this.client.user.id}> `);
    if (message.content.indexOf(prefix) != 0 && !message.content.match(prefixMention)) return;
  
    prefix = message.content.match(prefixMention) ? message.content.match(prefixMention)[0] : this.client.config.general.prefix;

    const args = message.content
      .slice(prefix.length)
      .trim()
      .split(/ +/g);
    const command = args.shift().toLowerCase();
    
    let cmd = this.client.commands.get(command);
    if (!cmd) cmd = this.client.commands.get(this.client.aliases.get(command));
    if(!cmd) return;

    if(!this.client.utils.hasPermissions(message, message.member, cmd.permissions) && 
      !this.client.utils.hasRole(this.client, message.guild, message.member, this.client.config.roles.bypass.permission) &&
      !message.member.permissions.has("Administrator")) return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.general.no_perm, this.client.embeds.error_color)] });

    if(this.client.cmdConfig[cmd.name]) {
      let cmdConfig = this.client.cmdConfig[cmd.name];
      if(cmdConfig.enabled == false) {
        if(this.client.language.general.cmd_disabled != "") message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.general.cmd_disabled, this.client.embeds.error_color)] });
        return;
      }
      if(cmdConfig && cmdConfig.roles.length > 0 && !this.client.utils.hasRole(this.client, message.guild, message.member, this.client.config.roles.bypass.permission) && !message.member.permissions.has("Administrator")) {
        let cmdRoles = cmdConfig.roles.map((x) => this.client.utils.findRole(message.guild, x));
        if(!this.client.utils.hasRole(this.client, message.guild, message.member, cmdConfig.roles)) return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.general.no_role.replace("<role>", cmdRoles.join(", ").trim()), this.client.embeds.error_color)] });
      }
      let findCooldown = this.client.cmdCooldowns.find((c) => c.name == cmd.name && c.id == message.author.id);
      if(!this.client.utils.hasRole(this.client, message.guild, message.member, this.client.config.roles.bypass.cooldown, true) && !message.member.permissions.has("Administrator")) {
        if(findCooldown) {
          let time = this.client.utils.formatTime(findCooldown.expiring - Date.now());
          return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.general.cooldown.replace("<cooldown>", time), this.client.embeds.error_color)] });
        } else if(!findCooldown && this.client.cmdConfig[cmd.name].cooldown > 0) {
          let cooldown = {
            id: message.author.id,
            name: cmd.name,
            expiring: Date.now() + (this.client.cmdConfig[cmd.name].cooldown * 1000),
          };
  
          this.client.cmdCooldowns.push(cooldown);
  
          setTimeout(() => {
            this.client.cmdCooldowns.splice(this.client.cmdCooldowns.indexOf(cooldown), 1);
          }, this.client.cmdConfig[cmd.name].cooldown * 1000);
        }
      }
    }

    cmd.run(message, args).then(() => {
      if(this.client.config.general.remove_command == true) message.delete()
    });
	}
};