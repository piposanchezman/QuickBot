const Command = require("../../structures/Command");
const { ApplicationCommandOptionType, MessageFlags } = require("discord.js");

module.exports = class ClientProfile extends Command {
  constructor(client) {
    super(client, {
      name: "clientprofile",
      description: client.cmdConfig.clientprofile.description,
      usage: client.cmdConfig.clientprofile.usage,
      permissions: client.cmdConfig.clientprofile.permissions,
      aliases: client.cmdConfig.clientprofile.aliases,
      category: "service",
      enabled: client.cmdConfig.clientprofile.enabled,
      slash: true,
      options: [{
        name: "client",
        description: "Client whose profile to see",
        type: ApplicationCommandOptionType.User,
        required: false
      }]
    });
  }

  async run(message, args) {
    let user = message.mentions.users.first() || message.author;
    let clientProfile = await this.client.database.usersData().get(`${user.id}.clientProfile`) || {
      orderCount: 0,
      amountSpent: 0,
    };

    message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.service.client_info.replace("<user>", user.username).replace("<userId>", user.id).replace("<orderCount>", clientProfile.orderCount).replace("<amountSpent>", clientProfile.amountSpent), this.client.embeds.success_color)] });
  }
  async slashRun(interaction, args) {
    let user = interaction.options.getUser("client") || interaction.user;
    let clientProfile = await this.client.database.usersData().get(`${user.id}.clientProfile`) || {
      orderCount: 0,
      amountSpent: 0,
    };

    interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.client_info.replace("<user>", user.username).replace("<userId>", user.id).replace("<orderCount>", clientProfile.orderCount).replace("<amountSpent>", clientProfile.amountSpent), this.client.embeds.success_color)], flags: this.client.cmdConfig.clientprofile.ephemeral ? MessageFlags.Ephemeral : 0 });
  }
};