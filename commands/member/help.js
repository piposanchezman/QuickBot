const Command = require("../../structures/Command");
const Discord = require("discord.js");

module.exports = class Help extends Command {
	constructor(client) {
		super(client, {
			name: "help",
			description: client.cmdConfig.help.description,
			usage: client.cmdConfig.help.usage,
			permissions: client.cmdConfig.help.permissions,
      aliases: client.cmdConfig.help.aliases,
			category: "member",
			enabled: client.cmdConfig.help.enabled,
      slash: true,
      options: [{
        name: "command",
        type: Discord.ApplicationCommandOptionType.String,
        description: "Command to get Info About",
        required: false
      }]
		});
	}
	async run(message, args) {
    const config = this.client.config;
    let prefix = this.client.config.general.prefix
    let user = message.author;
    let commandArg = args[0];
    
    if(!commandArg) {
      let commandsArray = this.client.commands.filter(
          c => c.enabled === true
        );
      let loadedCommands = [...commandsArray.values()];
      
      let contentMember = this.client.utils.commandsList(this.client, "member");
      let contentService = this.client.utils.commandsList(this.client, "service");
      let contentTickets = this.client.utils.commandsList(this.client, "tickets");
      let contentUtility = this.client.utils.commandsList(this.client, "utility");
      
      let helpMenu = new Discord.EmbedBuilder()
        .setColor(this.client.embeds.help.color);

      if(this.client.embeds.help.title) helpMenu.setTitle(this.client.embeds.help.title);
      let field = this.client.embeds.help.fields;
      for(let i = 0; i < this.client.embeds.help.fields.length; i++) {
        helpMenu.addFields([{ name: field[i].title, value: field[i].description.replace("<member>", contentMember)
          .replace("<service>", contentService)
          .replace("<utility>", contentUtility)
          .replace("<tickets>", contentTickets)
          .replace("<prefix>", prefix), inline: this.client.embeds.help.inline }])
      }
      
      if(this.client.embeds.help.footer == true) helpMenu.setFooter({ text: `Total Commands ${loadedCommands.length}`, iconURL: this.client.user.displayAvatarURL({ size: 1024, dynamic: true }) }).setTimestamp();
      if(this.client.embeds.help.thumbnail == true) helpMenu.setThumbnail(user.displayAvatarURL({ dynamic: true }));

      if(this.client.embeds.help.description) helpMenu.setDescription(this.client.embeds.help.description.replace("<member>", contentMember)
        .replace("<service>", contentService)
        .replace("<utility>", contentUtility)
        .replace("<tickets>", contentTickets)
        .replace("<prefix>", prefix));

      message.channel.send({ embeds: [helpMenu] });
    } else {
      let cmd = this.client.commands.get(commandArg.toLowerCase());
      if (!cmd) return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, `Error`
        , `You have entered invalid command/category.`, this.client.embeds.error_color)] });

      let cmdInfo = new Discord.EmbedBuilder()
        .setColor(this.client.embeds.command_info.color);
        
      if(this.client.embeds.command_info.title) cmdInfo.setTitle(this.client.embeds.command_info.title);
      let field = this.client.embeds.command_info.fields;
      for(let i = 0; i < this.client.embeds.command_info.fields.length; i++) {
        cmdInfo.addFields([{ name: field[i].title, value: field[i].description.replace("<name>", `${cmd.name}`)
          .replace("<description>", `${cmd.description}`)
          .replace("<usage>", `${cmd.usage}`)
          .replace("<category>", `${this.client.utils.capitalizeFirstLetter(cmd.category)}`)
          .replace("<prefix>", prefix), inline: this.client.embeds.command_info.inline }]);
      }
      
      if(this.client.embeds.command_info.footer == true) cmdInfo.setFooter({ text: user.username, iconURL: user.displayAvatarURL({ size: 1024, dynamic: true }) }).setTimestamp();
      if(this.client.embeds.command_info.thumbnail == true) cmdInfo.setThumbnail(user.displayAvatarURL({ dynamic: true }));
      
      if(this.client.embeds.command_info.description) cmdInfo.setDescription(this.client.embeds.command_info.description.replace("<name>", `${cmd.name}`)
        .replace("<description>", `${cmd.description}`)
        .replace("<usage>", `${cmd.usage}`)
        .replace("<category>", `${this.client.utils.capitalizeFirstLetter(cmd.category)}`)
        .replace("<prefix>", prefix));
  
      message.channel.send({ embeds: [cmdInfo] });
    }
  }
  async slashRun(interaction, args) {
    const config = this.client.config;
    let prefix = this.client.config.general.prefix
    let user = interaction.user;
    let commandArg = interaction.options.getString("command");
    
    if(!commandArg) {
      let commandsArray = this.client.commands.filter(
          c => c.enabled === true
        );
      let loadedCommands = [...commandsArray.values()];
      
      let contentMember = this.client.utils.commandsList(this.client, "member");
      let contentService = this.client.utils.commandsList(this.client, "service");
      let contentTickets = this.client.utils.commandsList(this.client, "tickets");
      let contentUtility = this.client.utils.commandsList(this.client, "utility");
      
      let helpMenu = new Discord.EmbedBuilder()
        .setColor(this.client.embeds.help.color);

      if(this.client.embeds.help.title) helpMenu.setTitle(this.client.embeds.help.title);
      let field = this.client.embeds.help.fields;
      for(let i = 0; i < this.client.embeds.help.fields.length; i++) {
        helpMenu.addFields([{ name: field[i].title, value: field[i].description.replace("<member>", contentMember)
          .replace("<service>", contentService)
          .replace("<utility>", contentUtility)
          .replace("<tickets>", contentTickets)
          .replace("<prefix>", prefix), inline: this.client.embeds.help.inline }])
      }
      
      if(this.client.embeds.help.footer == true) helpMenu.setFooter({ text: `Total Commands ${loadedCommands.length}`, iconURL: this.client.user.displayAvatarURL({ size: 1024, dynamic: true }) }).setTimestamp();
      if(this.client.embeds.help.thumbnail == true) helpMenu.setThumbnail(user.displayAvatarURL({ dynamic: true }));

      if(this.client.embeds.help.description) helpMenu.setDescription(this.client.embeds.help.description.replace("<member>", contentMember)
        .replace("<service>", contentService)
        .replace("<utility>", contentUtility)
        .replace("<tickets>", contentTickets)
        .replace("<prefix>", prefix));

      interaction.reply({ embeds: [helpMenu], flags: this.client.cmdConfig.help.ephemeral ? Discord.MessageFlags.Ephemeral : 0 });
    } else {
      let cmd = this.client.commands.get(commandArg.toLowerCase());
      if (!cmd) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, `Error`
        , this.client.language.general.invalid_cmd, this.client.embeds.error_color)], flags: this.client.cmdConfig.help.ephemeral ? Discord.MessageFlags.Ephemeral : 0 });

      let cmdInfo = new Discord.EmbedBuilder()
        .setColor(this.client.embeds.command_info.color);
        
      if(this.client.embeds.command_info.title) cmdInfo.setTitle(this.client.embeds.command_info.title);
      let field = this.client.embeds.command_info.fields;
      for(let i = 0; i < this.client.embeds.command_info.fields.length; i++) {
        cmdInfo.addFields([{ name: field[i].title, value: field[i].description.replace("<name>", `${cmd.name}`)
          .replace("<description>", `${cmd.description}`)
          .replace("<usage>", `${cmd.usage}`)
          .replace("<category>", `${this.client.utils.capitalizeFirstLetter(cmd.category)}`)
          .replace("<prefix>", prefix), inline: this.client.embeds.command_info.inline }]);
      }
      
      if(this.client.embeds.command_info.footer == true) cmdInfo.setFooter({ text: user.username, iconURL: user.displayAvatarURL({ size: 1024, dynamic: true }) }).setTimestamp();
      if(this.client.embeds.command_info.thumbnail == true) cmdInfo.setThumbnail(user.displayAvatarURL({ dynamic: true }));
      
      if(this.client.embeds.command_info.description) cmdInfo.setDescription(this.client.embeds.command_info.description.replace("<name>", `${cmd.name}`)
        .replace("<description>", `${cmd.description}`)
        .replace("<usage>", `${cmd.usage}`)
        .replace("<category>", `${this.client.utils.capitalizeFirstLetter(cmd.category)}`)
        .replace("<prefix>", prefix));
  
      interaction.reply({ embeds: [cmdInfo], flags: this.client.cmdConfig.help.ephemeral ? Discord.MessageFlags.Ephemeral : 0 });
    }
  }
};