const Command = require("../../structures/Command");
const Discord = require("discord.js");

module.exports = class Notes extends Command {
  constructor(client) {
    super(client, {
      name: "notes",
      description: client.cmdConfig.notes.description,
      usage: client.cmdConfig.notes.usage,
      permissions: client.cmdConfig.notes.permissions,
      aliases: client.cmdConfig.notes.aliases,
      category: "service",
      enabled: client.cmdConfig.notes.enabled,
      slash: true,
    });
  }

  async run(message, args) {
    let notes = args.join(" ");
    let option = await this.client.database.ticketsData().get(`${message.channel.id}.notes`);

    if(args[0]) {
      await this.client.database.ticketsData().set(`${message.channel.id}.notes`, notes);
      message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.service.note_added.replace("<note>", notes), this.client.embeds.success_color)] });
    } else {
      if(!option || option == null) return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.general.not_set, this.client.embeds.error_color)] });
      await this.client.database.ticketsData().delete(`${message.channel.id}.notes`);
      message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.service.note_reseted, this.client.embeds.success_color)] });
    }
  }
  
  async slashRun(interaction, args) {
    let option = await this.client.database.ticketsData().get(`${interaction.channel.id}.notes`) || "";
    
    let notesRow = new Discord.ActionRowBuilder()
      .addComponents(
        new Discord.TextInputBuilder()
          .setLabel(this.client.language.modals.labels.notes)
          .setPlaceholder(this.client.language.modals.placeholders.notes)
          .setStyle(Discord.TextInputStyle.Paragraph)
          .setCustomId("notes_value")
          .setValue(option)
      );
    let modal = new Discord.ModalBuilder()
      .setTitle(this.client.language.titles.notes)
      .setCustomId("notes_modal")
      .addComponents(notesRow);
      
    interaction.showModal(modal);
    
    let filter = (int) => int.customId == "notes_modal" && int.user.id == interaction.user.id;
    interaction.awaitModalSubmit({ filter, time: 120_000 }).then(async (int) => {
      let notesValue = int.fields.getTextInputValue("notes_value");
      
      if (notesValue.length > 6) {
        await this.client.database.ticketsData().set(`${interaction.channel.id}.notes`, notesValue);
        int.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.note_added.replace("<note>", notesValue), this.client.embeds.success_color)], flags: this.client.cmdConfig.notes.ephemeral ? Discord.MessageFlags.Ephemeral : 0 });
      } else {
        await this.client.database.ticketsData().delete(`${interaction.channel.id}.notes`);
        int.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.note_reseted, this.client.embeds.success_color)], flags: this.client.cmdConfig.notes.ephemeral ? Discord.MessageFlags.Ephemeral : 0 });
      }
    }).catch((err) => { })
  }
};
