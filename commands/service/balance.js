const Command = require("../../structures/Command");
const { ApplicationCommandOptionType, MessageFlags } = require("discord.js");

module.exports = class Balance extends Command {
  constructor(client) {
    super(client, {
      name: "balance",
      description: client.cmdConfig.balance.description,
      usage: client.cmdConfig.balance.usage,
      permissions: client.cmdConfig.balance.permissions,
      aliases: client.cmdConfig.balance.aliases,
      category: "service",
      enabled: client.cmdConfig.balance.enabled,
      slash: true,
      options: [{
        name: "user",
        description: "User whose balance to see",
        type: ApplicationCommandOptionType.User,
        required: false
      }]
    });
  }

  async run(message, args) {
    let user = message.mentions.users.first() || message.author;
    let balance = await this.client.database.usersData().get(`${user.id}.balance`) || 0;

    message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.service.balance.replace("<user>", user.username).replace("<userId>", user.id).replace("<balance>", balance), this.client.embeds.success_color)] });
  }
  async slashRun(interaction, args) {
    let user = interaction.options.getUser("user") || interaction.user;
    let balance = await this.client.database.usersData().get(`${user.id}.balance`) || 0;

    interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.balance.replace("<user>", user.username).replace("<userId>", user.id).replace("<balance>", balance), this.client.embeds.success_color)], flags: this.client.cmdConfig.balance.ephemeral ? MessageFlags.Ephemeral : 0 });
  }
};