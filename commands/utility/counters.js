const Command = require("../../structures/Command");
const Discord = require("discord.js");

module.exports = class Counters extends Command {
  constructor(client) {
    super(client, {
      name: "counters",
      description: client.cmdConfig.counters.description,
      usage: client.cmdConfig.counters.usage,
      permissions: client.cmdConfig.counters.permissions,
      aliases: client.cmdConfig.counters.aliases,
      category: "utility",
      enabled: client.cmdConfig.counters.enabled,
      slash: true,
    });
  }

  async run(message, args) {
    let config = this.client.config;

    let currentTickets = (await this.client.database.ticketsData().all());
    let totalTickets = await this.client.database.guildData().get(`${this.client.config.general.guild}.ticketCount`) || 0;
    let claimedTickets = await this.client.database.guildData().get(`${this.client.config.general.guild}.claimedTickets`) || 0;

    let m = await message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.utility.counters_started, this.client.embeds.general_color)] });

    let chCategory = await message.guild.channels.create({
      name: this.client.language.utility.counters_category,
      type: Discord.ChannelType.GuildCategory,
    });
    
    if(config.general.stats_type != "GUILD_VOICE" && config.general.stats_type != "GUILD_TEXT") return this.client.utils.sendError("Provided Channel Type for Counters (stats_type) is invalid. Valid types: GUILD_VOICE, GUILD_TEXT.")

    let chOpened = await message.guild.channels.create({
      name: `${this.client.language.utility.opened_counter.replace("<stats>", currentTickets.length)}`,
      type: config.general.stats_type == "GUILD_VOICE" ? Discord.ChannelType.GuildVoice : Discord.ChannelType.GuildText,
      parent: chCategory,
      permissionOverwrites: [
        {
          id: message.guild.roles.everyone.id,
          deny: ['Connect']
        }
      ]
    });
    let chTotal = await message.guild.channels.create({
      name: `${this.client.language.utility.total_counter.replace("<stats>", totalTickets)}`,
      type: config.general.stats_type == "GUILD_VOICE" ? Discord.ChannelType.GuildVoice : Discord.ChannelType.GuildText,
      parent: chCategory,
      permissionOverwrites: [
        {
          id: message.guild.roles.everyone.id,
          deny: ['Connect']
        }
      ]
    });
    let chClaimed = await message.guild.channels.create({
      name: `${this.client.language.utility.claimed_counter.replace("<stats>", claimedTickets)}`,
      type: config.general.stats_type == "GUILD_VOICE" ? Discord.ChannelType.GuildVoice : Discord.ChannelType.GuildText,
      parent: chCategory,
      permissionOverwrites: [
        {
          id: message.guild.roles.everyone.id,
          deny: ['Connect']
        }
      ]
    });

    const counters = {
      openedChannel: chOpened.id,
      totalChannel: chTotal.id,
      claimedChanel: chClaimed.id
    }

    await this.client.database.guildData().set(`${this.client.config.general.guild}.counters`, counters);

    await m.edit({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.utility.counters_created, this.client.embeds.general_color)] });
  }
  async slashRun(interaction, args) {
    let config = this.client.config;
  
    let currentTickets = (await this.client.database.ticketsData().all());
    let totalTickets = await this.client.database.guildData().get(`${this.client.config.general.guild}.ticketCount`) || 0;
    let claimedTickets = await this.client.database.guildData().get(`${this.client.config.general.guild}.claimedTickets`) || 0;

    await interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.utility.counters_started, this.client.embeds.general_color)], flags: this.client.cmdConfig.counters.ephemeral ? Discord.MessageFlags.Ephemeral : 0 });
  
    let chCategory = await interaction.guild.channels.create({
      name: this.client.language.utility.counters_category,
      type: Discord.ChannelType.GuildCategory,
    });

    let chOpened = await interaction.guild.channels.create({
      name: `${this.client.language.utility.opened_counter.replace("<stats>", currentTickets.length)}`,
      type: config.general.stats_type == "GUILD_VOICE" ? Discord.ChannelType.GuildVoice : Discord.ChannelType.GuildText,
      parent: chCategory,
      permissionOverwrites: [
        {
          id: interaction.guild.roles.everyone.id,
          deny: ['Connect']
        }
      ]
    });
    let chTotal = await interaction.guild.channels.create({
      name: `${this.client.language.utility.total_counter.replace("<stats>", totalTickets)}`,
      type: config.general.stats_type == "GUILD_VOICE" ? Discord.ChannelType.GuildVoice : Discord.ChannelType.GuildText,
      parent: chCategory,
      permissionOverwrites: [
        {
          id: interaction.guild.roles.everyone.id,
          deny: ['Connect']
        }
      ]
    });
    let chClaimed = await interaction.guild.channels.create({
      name: `${this.client.language.utility.claimed_counter.replace("<stats>", claimedTickets)}`,
      type: config.general.stats_type == "GUILD_VOICE" ? Discord.ChannelType.GuildVoice : Discord.ChannelType.GuildText,
      parent: chCategory,
      permissionOverwrites: [
        {
          id: interaction.guild.roles.everyone.id,
          deny: ['Connect']
        }
      ]
    });
    
    const counters = {
      openedChannel: chOpened.id,
      totalChannel: chTotal.id,
      claimedChanel: chClaimed.id
    }

    await this.client.database.guildData().set(`${this.client.config.general.guild}.counters`, counters);
    
    await interaction.followUp({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.utility.counters_created, this.client.embeds.general_color)], flags: this.client.cmdConfig.counters.ephemeral ? Discord.MessageFlags.Ephemeral : 0 });
  }
};
