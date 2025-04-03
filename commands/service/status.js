const Command = require("../../structures/Command");
const { MessageFlags } = require("discord.js");

module.exports = class Status extends Command {
  constructor(client) {
    super(client, {
      name: "status",
      description: client.cmdConfig.status.description,
      usage: client.cmdConfig.status.usage,
      permissions: client.cmdConfig.status.permissions,
      aliases: client.cmdConfig.status.aliases,
      category: "service",
      enabled: client.cmdConfig.status.enabled,
      slash: true
    });
  }

  async run(message, args) {
    let away = await this.client.database.usersData().get(`${message.author.id}.status`);

    if(away == null || !away) {
      await this.client.database.usersData().set(`${message.author.id}.status`, 1);
      message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.service.status.replace("<status>", this.client.language.service.availability.unavailable), this.client.embeds.success_color)] });
    } else if(away == 1) {
      await this.client.database.usersData().delete(`${message.author.id}.status`);
      message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.service.status.replace("<status>", this.client.language.service.availability.available), this.client.embeds.success_color)] });
    }
  }
  async slashRun(interaction, args) {
    let away = await this.client.database.usersData().get(`${interaction.user.id}.status`);

    if(away == null || !away) {
      await this.client.database.usersData().set(`${interaction.user.id}.status`, 1);
      interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.status.replace("<status>", this.client.language.service.availability.unavailable), this.client.embeds.success_color)], flags: this.client.cmdConfig.status.ephemeral ? MessageFlags.Ephemeral : 0 });
    } else if(away == 1) {
      await this.client.database.usersData().delete(`${interaction.user.id}.status`);
      interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.status.replace("<status>", this.client.language.service.availability.available), this.client.embeds.success_color)], flags: this.client.cmdConfig.status.ephemeral ? MessageFlags.Ephemeral : 0 });
    }
  }
};