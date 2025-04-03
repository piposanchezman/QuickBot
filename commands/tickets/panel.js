const Command = require("../../structures/Command");
const { EmbedBuilder, ActionRowBuilder, MessageFlags,
  ButtonBuilder, ApplicationCommandOptionType, StringSelectMenuBuilder, ButtonStyle } = require('discord.js');

module.exports = class Panel extends Command {
	constructor(client) {
		super(client, {
			name: "panel",
			description: client.cmdConfig.panel.description,
			usage: client.cmdConfig.panel.usage,
			permissions: client.cmdConfig.panel.permissions,
      aliases: client.cmdConfig.panel.aliases,
			category: "tickets",
			enabled: client.cmdConfig.panel.enabled,
      slash: true,
      options: [{
        name: "category",
        description: "Ticket Category for Panel, separate with spaces for more than 1 (If want Separate Panels)",
        type: ApplicationCommandOptionType.String,
        required: false,
      }]
		});
	}
  
  async run(message, args) {
    let config = this.client.config;
    let language = this.client.language;
    let category = args.length > 0 ? args : ["general"];

    let separatedPanel = category.length >= 1 && !category.includes("general");
    const listOfCategories = this.client.categories;
    let findCategory = [];

    for(const arg of category) {
      findCategory.push(listOfCategories.map((c) => {
        return this.client.utils.ticketCategoryById(c, arg);
      }).filter(Boolean)?.[0]);
    }

    if(separatedPanel == true && (findCategory.length == 0 || findCategory.includes(undefined))) 
      return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, language.ticket.invalid_panel, this.client.embeds.error_color)] });

    const chunks = [];
    let componentList = [],
      buttonList = [];
    if(this.client.config.tickets.panel_type == "BUTTONS") {
      for (let i = 0; i < findCategory.length; i += config.tickets.panel_buttons_line) {
        const chunk = findCategory.slice(i, i + config.tickets.panel_buttons_line);
        chunks.push(chunk);
      }

      for (let i = 0; i < chunks.length; i++) {
        buttonList.push(
          chunks[i].map((x) => {
            return new ButtonBuilder()
              .setLabel(separatedPanel == true ? `${x.name}` : this.client.language.buttons.create)
              .setEmoji(separatedPanel == true ? `${x.emoji || {}}` : config.emojis.create || {})
              .setStyle(separatedPanel == true ? ButtonStyle[x.button_color] : ButtonStyle.Primary)
              .setCustomId(separatedPanel == true ? `createTicket_${x.id}` : 'createTicket');
          })
        );
      }
    
      buttonList.forEach((b) => {
        componentList.push(new ActionRowBuilder().addComponents(b.map((x) => x)));
      });
    }

    const options = [];
    if(separatedPanel == true && config.tickets.panel_type == "SELECT_MENU") {
      findCategory.forEach((c) => {
        options.push({
          label: c.name,
          value: c.id, 
          emoji: c.emoji || {},
          description: c.placeholder != "" ? c.placeholder : ""
        });
      })
    } else {
      this.client.categories.forEach(c => {
        options.push({
          label: c.name,
          value: c.id, 
          emoji: c.emoji || {},
          description: c.placeholder != "" ? c.placeholder : ""
        });
      });
    }
     
    let sMenu = new StringSelectMenuBuilder()
      .setCustomId("noSelection_panel")
      .setPlaceholder(config.tickets.select_placeholder)
      .addOptions(options);

    let row = new ActionRowBuilder()
      .addComponents(sMenu);

    let embed = new EmbedBuilder();
    if(findCategory.length >= 1 && separatedPanel == true) {
      embed.setTitle(findCategory[0].panel.title || null)
        .setDescription(findCategory[0].panel.description || null)
        .setImage(findCategory[0].panel.image || null)
        .setThumbnail(findCategory[0].panel.thumbnail || null)
        .setColor(`${findCategory[0].panel.color}`);
    } else {
      embed.setTitle(this.client.embeds.panel_title)
        .setDescription(this.client.embeds.panel_message)
        .setColor(this.client.embeds.general_color);

      if(this.client.embeds.panel.footer) embed.setFooter({ text: this.client.embeds.panel.footer, iconURL: this.client.user.displayAvatarURL() }).setTimestamp();
      if(this.client.embeds.panel.image.enabled == true) embed.setImage(this.client.embeds.panel.image.url);
    }
      
    if(this.client.embeds.panel.thumbnail.enabled == true) embed.setThumbnail(this.client.embeds.panel.thumbnail.url);

    message.channel.send({embeds: [embed], components: config.tickets.panel_type == "SELECT_MENU" ? [row] : componentList});
  }
  async slashRun(interaction, args) {
    let config = this.client.config;
    let language = this.client.language;
    const listOfCategories = this.client.categories;
    const splitArgs = interaction.options.getString("category")?.split(" ");

    let category = splitArgs?.length > 0 ? splitArgs : ["general"];
    let separatedPanel = category.length >= 1 && !category.includes("general");
    let findCategory = [];

    for(const arg of category) {
      findCategory.push(listOfCategories.map((c) => {
        return this.client.utils.ticketCategoryById(c, arg);
      }).filter(Boolean)?.[0]);
    }

    if(separatedPanel == true && (findCategory.length == 0 || findCategory.includes(undefined))) 
      return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, language.ticket.invalid_panel, this.client.embeds.error_color)], flags: MessageFlags.Ephemeral });

    const chunks = [];
    let componentList = [],
      buttonList = [];
    if(this.client.config.tickets.panel_type == "BUTTONS") {
      for (let i = 0; i < findCategory.length; i += config.tickets.panel_buttons_line) {
        const chunk = findCategory.slice(i, i + config.tickets.panel_buttons_line);
        chunks.push(chunk);
      }

      for (let i = 0; i < chunks.length; i++) {
        buttonList.push(
          chunks[i].map((x) => {
            return new ButtonBuilder()
              .setLabel(separatedPanel == true ? `${x.name}` : this.client.language.buttons.create)
              .setEmoji(separatedPanel == true ? `${x.emoji || {}}` : config.emojis.create || {})
              .setStyle(separatedPanel == true ? ButtonStyle[x.button_color] : ButtonStyle.Primary)
              .setCustomId(separatedPanel == true ? `createTicket_${x.id}` : 'createTicket');
          })
        );
      }
    
      buttonList.forEach((b) => {
        componentList.push(new ActionRowBuilder().addComponents(b.map((x) => x)));
      });
    }
      
    const options = [];
    if(separatedPanel == true && config.tickets.panel_type == "SELECT_MENU") {
      findCategory.forEach((c) => {
        options.push({
          label: c.name,
          value: c.id, 
          emoji: c.emoji || {},
          description: c.placeholder != "" ? c.placeholder : ""
        });
      })
    } else {
      this.client.categories.forEach(c => {
        options.push({
          label: c.name,
          value: c.id, 
          emoji: c.emoji || {},
          description: c.placeholder != "" ? c.placeholder : ""
        });
      });
    }

    let sMenu = new StringSelectMenuBuilder()
      .setCustomId("noSelection_panel")
      .setPlaceholder(config.tickets.select_placeholder)
      .addOptions(options);

    let row = new ActionRowBuilder()
      .addComponents(sMenu);

    let embed = new EmbedBuilder();
    if(findCategory.length >= 1 && separatedPanel == true) {
      embed.setTitle(findCategory[0].panel.title || null)
        .setDescription(findCategory[0].panel.description || null)
        .setImage(findCategory[0].panel.image || null)
        .setThumbnail(findCategory[0].panel.thumbnail || null)
        .setColor(`${findCategory[0].panel.color}`);
    } else {
      embed.setTitle(this.client.embeds.panel_title)
        .setDescription(this.client.embeds.panel_message)
        .setColor(this.client.embeds.general_color);
        
      if(this.client.embeds.panel.footer) embed.setFooter({ text: this.client.embeds.panel.footer, iconURL: this.client.user.displayAvatarURL() }).setTimestamp();
      if(this.client.embeds.panel.image.enabled == true) embed.setImage(this.client.embeds.panel.image.url);
    }

    if(this.client.embeds.panel.thumbnail.enabled == true) embed.setThumbnail(this.client.embeds.panel.thumbnail.url);

    interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.ticket.panel_created, this.client.embeds.success_color)], flags: MessageFlags.Ephemeral });
    interaction.channel.send({embeds: [embed], components: config.tickets.panel_type == "SELECT_MENU" ? [row] : componentList});
  }
};