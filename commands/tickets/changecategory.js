const Command = require("../../structures/Command");
const { ApplicationCommandOptionType, OverwriteType, MessageFlags } = require("discord.js");

module.exports = class ChangeCategory extends Command {
	constructor(client) {
		super(client, {
			name: "changecategory",
			description: client.cmdConfig.changecategory.description,
			usage: client.cmdConfig.changecategory.usage,
			permissions: client.cmdConfig.changecategory.permissions,
      aliases: client.cmdConfig.changecategory.aliases,
			category: "tickets",
			enabled: client.cmdConfig.changecategory.enabled,
      slash: true,
      options: [{
        name: 'category',
        type: ApplicationCommandOptionType.String,
        description: "Category to which to move Ticket",
        required: true,
      }]
		});
	}
  
  async run(message, args) {
    let config = this.client.config;

    if (!await this.client.utils.isTicket(this.client, message.channel)) 
      return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.ticket.ticket_channel, this.client.embeds.error_color)] });
    let category = args.join(" ");
    if(!category) return message.channel.send({ embeds: [this.client.utils.usage(this.client, message, this.client.cmdConfig.changecategory.usage)] });

    const findCategory = this.client.categories.map((c) => {
      const subSearch = c.subcategories?.find((sc) => sc.id.toLowerCase() == category.toLowerCase() || sc.id.toLowerCase().includes(category.toLowerCase()));
      if(c.id.toLowerCase() == category.toLowerCase() || c.id.toLowerCase().includes(category.toLowerCase()))
        return c;
      else if(subSearch)
        return subSearch;
    }).filter(Boolean)?.[0];

    if(!findCategory || findCategory.category == "" || !this.client.utils.findChannel(message.guild, findCategory.category)) return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.language.titles.error, this.client.language.ticket.invalid_category, this.client.embeds.error_color)] });
    if(config.tickets.separate_categories == false || config.tickets.category_status == false) return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.language.titles.error, this.client.language.ticket.not_separate, this.client.embeds.error_color)] });

    const ticketData = await this.client.database.ticketsData().get(`${message.channel.id}.ticketData`) || {};
    const ticketOwner = this.client.users.cache.get(ticketData.owner);
    const editCategory = this.client.utils.findChannel(message.guild, findCategory.category);
    
    const canRename = await this.client.utils.canEditName(message.guild, message.channel);
    message.channel.edit({
      name: config.tickets.rename_choose == true && findCategory.channel_name != "" && canRename == true && ticketOwner ? this.client.utils.ticketPlaceholders(findCategory.channel_name, ticketOwner, ticketData.id) : message.channel.name,
      parent: editCategory,
      lockPermissions: false,
    });

    let suppEdit = this.client.config.roles.support.map((x) => this.client.utils.findRole(message.guild, x));
    suppEdit = suppEdit.filter((r) => r != undefined); 
    if(this.client.config.tickets.separate_roles.enabled == true && findCategory.roles.length > 0) {
      let editRole = findCategory.roles.map((x) => this.client.utils.findRole(message.guild, x));
      editRole = editRole.filter((r) => r != undefined);

      const currentPerms = message.channel.permissionOverwrites.cache;
      for(const perm of currentPerms) {
        if(perm[1].type == OverwriteType.Role && perm[0] != message.guild.id) {
          await message.channel.permissionOverwrites.delete(perm[0]);
        }
      }
  
      for(const r of editRole) {
        message.channel.permissionOverwrites.edit(r, {
          SendMessages: true,
          ViewChannel: true
        }); 
      }
      if(this.client.config.roles.support.length > 0 && this.client.config.tickets.separate_roles.both == false) {
        for(const supp of suppEdit) {
          message.channel.permissionOverwrites.edit(supp, {
            SendMessages: false,
            ViewChannel: false
          });
        }
      } else {
        for(const supp of suppEdit) {
          message.channel.permissionOverwrites.edit(supp, {
            SendMessages: true,
            ViewChannel: true
          });
        }
      }
    } else {
      for(const supp of suppEdit) {
        message.channel.permissionOverwrites.edit(supp, {
          SendMessages: true,
          ViewChannel: true
        });
      }
    }

    if(!message.channel.topic) message.channel.setTopic(this.client.language.ticket.move_topic.replace("<category>", findCategory.name).replace("<user>", message.author));
    else message.channel.setTopic("\n" + this.client.language.ticket.move_topic.replace("<category>", findCategory.name).replace("<user>", message.author));

    message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.embeds.title, this.client.language.ticket.category_moved.replace("<category>", findCategory.name).replace("<user>", message.author), this.client.embeds.general_color)] });
  }
  async slashRun(interaction, args) {
    let config = this.client.config;
    let category = interaction.options.getString("category");

    if (!await this.client.utils.isTicket(this.client, interaction.channel)) 
      return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.ticket.ticket_channel, this.client.embeds.error_color)] });

    const findCategory = this.client.categories.map((c) => {
      const subSearch = c.subcategories?.find((sc) => sc.id.toLowerCase() == category.toLowerCase() || sc.id.toLowerCase().includes(category.toLowerCase()));
      if(c.id.toLowerCase() == category.toLowerCase() || c.id.toLowerCase().includes(category.toLowerCase()))
        return c;
      else if(subSearch)
        return subSearch;
    }).filter(Boolean)?.[0];
    if(!findCategory || findCategory.category == "" || !this.client.utils.findChannel(interaction.guild, findCategory.category)) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.language.titles.error, this.client.language.ticket.invalid_category, this.client.embeds.error_color)] });
    if(config.tickets.separate_categories == false || config.tickets.category_status == false) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.language.titles.error, this.client.language.ticket.not_separate, this.client.embeds.error_color)] });
    
    const ticketData = await this.client.database.ticketsData().get(`${interaction.channel.id}.ticketData`) || {};
    const ticketOwner = this.client.users.cache.get(ticketData.owner);

    let editCategory = this.client.utils.findChannel(interaction.guild, findCategory.category);
    
    const canRename = await this.client.utils.canEditName(interaction.guild, interaction.channel);
    interaction.channel.edit({
      name: config.tickets.rename_choose == true && findCategory.channel_name != "" && canRename == true && ticketOwner ? this.client.utils.ticketPlaceholders(findCategory.channel_name, ticketOwner, ticketData.id) : interaction.channel.name,
      parent: editCategory,
      lockPermissions: false,
    });

    let suppEdit = this.client.config.roles.support.map((x) => this.client.utils.findRole(interaction.guild, x));
    suppEdit = suppEdit.filter((r) => r != undefined); 
    if(this.client.config.tickets.separate_roles.enabled == true && findCategory.roles.length > 0) {
      let editRole = findCategory.roles.map((x) => this.client.utils.findRole(interaction.guild, x));
      editRole = editRole.filter((r) => r != undefined);

      const currentPerms = interaction.channel.permissionOverwrites.cache;
      for(const perm of currentPerms) {
        if(perm[1].type == OverwriteType.Role && perm[0] != interaction.guild.id) {
          await interaction.channel.permissionOverwrites.delete(perm[0]);
        }
      }
  
      for(const r of editRole) {
        interaction.channel.permissionOverwrites.edit(r, {
          SendMessages: true,
          ViewChannel: true
        }); 
      }
      if(this.client.config.roles.support.length > 0 && this.client.config.tickets.separate_roles.both == false) {
        for(const supp of suppEdit) {
          interaction.channel.permissionOverwrites.edit(supp, {
            SendMessages: false,
            ViewChannel: false
          });
        }
      } else {
        for(const supp of suppEdit) {
          interaction.channel.permissionOverwrites.edit(supp, {
            SendMessages: true,
            ViewChannel: true
          });
        }
      }
    } else {
      for(const supp of suppEdit) {
        interaction.channel.permissionOverwrites.edit(supp, {
          SendMessages: true,
          ViewChannel: true
        });
      }
    }

    if(!interaction.channel.topic) interaction.channel.setTopic(this.client.language.ticket.move_topic.replace("<category>", findCategory.name).replace("<user>", interaction.user));
    else interaction.channel.setTopic("\n" + this.client.language.ticket.move_topic.replace("<category>", findCategory.name).replace("<user>", interaction.user));
      
    interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.ticket.category_moved.replace("<category>", findCategory.name).replace("<user>", interaction.user), this.client.embeds.general_color)], flags: this.client.cmdConfig.changecategory.ephemeral ? MessageFlags.Ephemeral : 0 });
  }
};