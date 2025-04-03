const Command = require("../../structures/Command");
const { ApplicationCommandOptionType, EmbedBuilder, MessageFlags, ActionRowBuilder } = require("discord.js");

module.exports = class BumpCommission extends Command {
  constructor(client) {
    super(client, {
      name: "bumpcommission",
      description: client.cmdConfig.bumpcommission.description,
      usage: client.cmdConfig.bumpcommission.usage,
      permissions: client.cmdConfig.bumpcommission.permissions,
      aliases: client.cmdConfig.bumpcommission.aliases,
      category: "service",
      enabled: client.cmdConfig.bumpcommission.enabled,
      slash: true,
      options: [{
        name: "commission_channel",
        description: "Commission Channel which embed you want to resend",
        type: ApplicationCommandOptionType.Channel,
        required: true
      }]
    });
  }

  async run(message, args) {
    let channel = message.mentions.channels.first() || message.channel;
    let commission = await this.client.database.ticketsData().get(`${channel.id}.commission`);
    let commissionsChannel = this.client.utils.findChannel(message.guild, commission.commChannelId);

    let oldCommEmbed = commission.commMessageId;
    if(!commissionsChannel || !commission || !oldCommEmbed) return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.service.commission.not_commission, this.client.embeds.error_color)] });

    let channelData = await this.client.database.ticketsData().get(`${channel.id}`);
    const listOfQuestions = channelData.listOfQuestions;
    let categoryCommRoles = listOfQuestions.ticketCategory.commission.roles.map((x) => {
      let findRole = this.client.utils.findRole(message.channel.guild, x);
      if(findRole) return findRole;
    });

    let commFetchedMsg = await commissionsChannel.messages.fetch({ message: commission.commMessageId });
    
    const redoEmbed = EmbedBuilder.from(commFetchedMsg.embeds[0].data);
    const redoButtons = ActionRowBuilder.from(commFetchedMsg.components[0]);
    await commissionsChannel.send({ content: categoryCommRoles.length > 0 ? `${categoryCommRoles.join(" ")}` : '', embeds: [redoEmbed], components: [redoButtons] }).then(async(m) => {
      const newCommission = await this.client.database.ticketsData().get(`${channel.id}.commission`);
      newCommission.commMessageId = m.id;
      newCommission.commChannelId = m.channel.id;
      
      await m.startThread({ name: this.client.language.service.commission.commission_thread.replace("<id>", newCommission.id) }).then(async(thread) => {
        newCommission.commThreadId = thread.id;
        // @TODO: Place to send Attachments like in original embed
      });
      await this.client.database.ticketsData().set(`${channel.id}.commission`, newCommission);
    });

    if(commFetchedMsg?.hasThread) {
      await commFetchedMsg.thread.delete().catch((err) => {});
    }
    await commFetchedMsg.delete();

    await message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.service.commission.embed_resent.replace("<channel>", channel), this.client.embeds.success_color)] });
  }
  async slashRun(interaction, args) {
    let channel = interaction.options.getChannel("commission_channel") || interaction.channel;
    let commission = await this.client.database.ticketsData().get(`${channel.id}.commission`);
    let commissionsChannel = this.client.utils.findChannel(interaction.guild, commission.commChannelId);

    let oldCommEmbed = commission.commMessageId;
    if(!commissionsChannel || !commission || !oldCommEmbed) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.commission.not_commission, this.client.embeds.error_color)], flags: this.client.cmdConfig.bumpcommission.ephemeral ? MessageFlags.Ephemeral : 0 });

    let channelData = await this.client.database.ticketsData().get(`${channel.id}`);
    const listOfQuestions = channelData.listOfQuestions;
    let categoryCommRoles = listOfQuestions.ticketCategory.commission.roles.map((x) => {
      let findRole = this.client.utils.findRole(interaction.channel.guild, x);
      if(findRole) return findRole;
    });

    let commFetchedMsg = await commissionsChannel.messages.fetch({ message: commission.commMessageId });
    
    const redoEmbed = EmbedBuilder.from(commFetchedMsg.embeds[0].data);
    const redoButtons = ActionRowBuilder.from(commFetchedMsg.components[0]);
    await commissionsChannel.send({ content: categoryCommRoles.length > 0 ? `${categoryCommRoles.join(" ")}` : '', embeds: [redoEmbed], components: [redoButtons] }).then(async(m) => {
      const newCommission = await this.client.database.ticketsData().get(`${channel.id}.commission`);
      newCommission.commMessageId = m.id;
      newCommission.commChannelId = m.channel.id;
      
      await m.startThread({ name: this.client.language.service.commission.commission_thread.replace("<id>", newCommission.id) }).then(async(thread) => {
        newCommission.commThreadId = thread.id;
        // @TODO: Place to send Attachments like in original embed
      });
      await this.client.database.ticketsData().set(`${channel.id}.commission`, newCommission);
    });

    if(commFetchedMsg?.hasThread) {
      await commFetchedMsg.thread.delete().catch((err) => {});
    }
    await commFetchedMsg.delete();

    await interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.commission.embed_resent.replace("<channel>", channel), this.client.embeds.success_color)], flags: this.client.cmdConfig.bumpcommission.ephemeral ? MessageFlags.Ephemeral : 0 });
  }
};