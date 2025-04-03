const Event = require("../../structures/Events");
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, StringSelectMenuBuilder,
  PermissionFlagsBits, ComponentType, ChannelType, ButtonStyle, InteractionType, MessageFlags } = require("discord.js");
const { chatAskQuestions } = require("../../utils/askQuestions");
const { ticketCategory, ticketSubCategory } = require("../../utils/ticketCategory");

module.exports = class TicketCreate extends Event {
  constructor(...args) {
    super(...args);
  }

  async run(message, member, reason = "No Reason Provided", separatedPanel = {
    status: false,
    cat_id: "n/a",
    subcategory: null
  }) {
    let config = this.client.config;
    let language = this.client.language;
    let mainCategory = this.client.utils.findChannel(message.guild, config.channels.tickets_category);
    if(!mainCategory) this.client.utils.sendError("Provided Channel Category (tickets_category) is invalid or belongs to other Server.");
    let everyone = message.guild.roles.cache.find(r => r.name === "@everyone");

    const componentList = (row, select = null) => {
      if(config.general.buttons.close == false) row.components = row.components.filter((x) => x.data.custom_id != "closeTicket");
      if(config.general.buttons.claim == false) row.components = row.components.filter((x) => x.data.custom_id != "claimTicket");

      if(select) return row.components.length == 0 ? [select] : [select, row];

      return row.components.length == 0 ? [] : [row];
    }
    
    if(config.tickets.category_status == false) {
      let memberTicket = await this.client.database.usersData().get(`${member.id}.tickets`) || [];
      
      if(memberTicket.length >= config.tickets.ticket_limit) {
        if(message.type == InteractionType.ApplicationCommand) {
          message.reply({ embeds: [this.client.embedBuilder(this.client, member.user, this.client.embeds.title, this.client.language.ticket.already_open, this.client.embeds.error_color)], flags: MessageFlags.Ephemeral }); 
          return;
        } else if(message.type == InteractionType.MessageComponent) {
          message.followUp({ embeds: [this.client.embedBuilder(this.client, member.user, this.client.embeds.title, this.client.language.ticket.already_open, this.client.embeds.error_color)], flags: MessageFlags.Ephemeral }); 
          return;
        } else {
          message.channel.send({ embeds: [this.client.embedBuilder(this.client, member.user, this.client.embeds.title, this.client.language.ticket.already_open, this.client.embeds.error_color)] }).then((msg) => setTimeout(() => msg.delete().catch((err) => { }), 5000)) 
          return;
        }
      }
    } else if(config.tickets.category_status == true && config.tickets.separate_categories == true) {
      let memberTicket = await this.client.database.usersData().get(`${member.id}.tickets`) || [];
      const fallbackParents = this.client.config.channels.fallback_categories.map((fb) => this.client.utils.findChannel(message.guild, fb)?.id);
      let userTickets = memberTicket.filter((x) => x.member == member.id && (x.parent == mainCategory.id || fallbackParents.includes(x.parent)));

      if(userTickets.length >= 1) {
        if(message.type == InteractionType.ApplicationCommand) {
          message.reply({ embeds: [this.client.embedBuilder(this.client, member.user, this.client.embeds.title, this.client.language.ticket.have_in_sel, this.client.embeds.error_color)], flags: MessageFlags.Ephemeral }); 
          return;
        } else if(message.type == InteractionType.MessageComponent) {
          message.followUp({ embeds: [this.client.embedBuilder(this.client, member.user, this.client.embeds.title, this.client.language.ticket.have_in_sel, this.client.embeds.error_color)], flags: MessageFlags.Ephemeral }); 
          return;
        } else {
          message.channel.send({ embeds: [this.client.embedBuilder(this.client, member.user, this.client.embeds.title, this.client.language.ticket.have_in_sel, this.client.embeds.error_color)] }).then((msg) => setTimeout(() => msg.delete().catch((err) => { }), 5000)) 
          return;
        }
      }
    } else if(config.tickets.category_status == true && config.tickets.separate_categories == false) {
      let isChoosing = await this.client.database.usersData().get(`${member.id}.choosingCategory`);
      if(isChoosing) {
        if(message.type == InteractionType.ApplicationCommand) {
          message.reply({ embeds: [this.client.embedBuilder(this.client, member.user, this.client.embeds.title, this.client.language.ticket.have_in_sel, this.client.embeds.error_color)], flags: MessageFlags.Ephemeral }); 
          return;
        } else if(message.type == InteractionType.MessageComponent) {
          message.followUp({ embeds: [this.client.embedBuilder(this.client, member.user, this.client.embeds.title, this.client.language.ticket.have_in_sel, this.client.embeds.error_color)], flags: MessageFlags.Ephemeral }); 
          return;
        } else {
          message.channel.send({ embeds: [this.client.embedBuilder(this.client, member.user, this.client.embeds.title, this.client.language.ticket.have_in_sel, this.client.embeds.error_color)] }).then((msg) => setTimeout(() => msg.delete().catch((err) => { }), 5000)) 
          return;
        }
      }
    }

    if(separatedPanel.status == true) {
      let ca = this.client.categories.find((cat) => cat.id.toLowerCase() == separatedPanel.cat_id.toLowerCase());
      if(!ca) {
        message.followUp({ embeds: [this.client.embedBuilder(this.client, member.user, this.client.embeds.title, this.client.language.ticket.invalid_panel, this.client.embeds.error_color)], flags: MessageFlags.Ephemeral });
        return;
      }

      if(separatedPanel.subcategory)
        ca = ca.subcategories.find((sub) => sub.id.toLowerCase() == separatedPanel.subcategory.toLowerCase());
      
      let memberTickets = await this.client.database.usersData().get(`${member.id}.tickets`) || [];
      const categoryParent = this.client.utils.findChannel(message.guild, ca.category);
      const fallbackParents = ca.fallback_categories.map((fb) => this.client.utils.findChannel(message.guild, fb)?.id);
      let listOfTickets = memberTickets.filter((x) => x.member == member.id && x.ticketCategory == ca.id);

      if(config.tickets.separate_categories == false) {
        if(listOfTickets.length >= ca.limit) {
          message.followUp({ embeds: [this.client.embedBuilder(this.client, member.user, this.client.embeds.title, language.ticket.have_ticket_category, this.client.embeds.error_color)], flags: MessageFlags.Ephemeral });
          return;
        }
      } else if(config.tickets.separate_categories == true) {
        let childrenTickets = memberTickets || [];
        let separatePanelCategory = childrenTickets.filter((x) => (x.parent == categoryParent?.id || fallbackParents.includes(x.parent)) && x.ticketCategory == ca.id);
        
        if(separatePanelCategory.length >= ca.limit) {
          message.followUp({ embeds: [this.client.embedBuilder(this.client, member.user, this.client.embeds.title, language.ticket.have_ticket_category, this.client.embeds.error_color)], flags: MessageFlags.Ephemeral });
          return;
        }
      }
    }
    const blacklistedNumbers = [1352, 1390, 1423, 1488];
    let ticketId = parseInt((await this.client.database.guildData().get(`${this.client.config.general.guild}.ticketCount`) || 0) + 1);
    if(blacklistedNumbers.includes(parseInt(ticketId))) ticketId++;
    message.guild.channels.create({
        name: this.client.utils.ticketPlaceholders(config.channels.channel_name, member.user, ticketId),
        type: ChannelType.GuildText,
        parent: this.client.utils.findTicketParent(message.guild, this.client.config.channels.tickets_category, this.client.config.channels.fallback_categories),
        permissionOverwrites: [
          {
            id: this.client.user.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels],
          },
          {
            id: member.user.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles],
            deny: [PermissionFlagsBits.SendMessagesInThreads]
          },
          {
            id: everyone.id,
            allow: [PermissionFlagsBits.AttachFiles],
            deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
          }
        ],
      }).then(async (c) => {
        await this.client.database.usersData().push(`${member.id}.tickets`, {
          member: member.id,
          channel: c.id,
          reason: reason || "N/A",
          parent: c.parentId
        });

        await this.client.database.ticketsData().set(`${c.id}.ticketData`, {
          owner: member.user.id,
          openedAt: new Date(),
          openedTimestamp: message.createdTimestamp,
          id: ticketId
        });

        if(this.client.config.server.dashboard.home.chart.save_open == true)
          await this.client.database.guildData().push(`${this.client.config.general.guild}.todayStats`, { action: "OPEN" });
        
        await this.client.database.guildData().add(`${this.client.config.general.guild}.ticketCount`, 1);

        if(this.client.config.tickets.category_status == false) {
          c.permissionOverwrites.edit(member.id, {
            SendMessages: true,
            ViewChannel: true,
            SendMessagesInThreads: false
          });
        } else {
          c.permissionOverwrites.edit(member.id, {
            SendMessages: false,
            ViewChannel: true,
            SendMessagesInThreads: false
          });
        }

        c.setTopic(language.ticket.channel_topic.replace("<author>", member.user.username));
        if(config.roles.support.length > 0) {
          for(let i = 0; i < config.roles.support.length; i++) {
            let findRole = this.client.utils.findRole(message.guild, config.roles.support[i]);
            c.permissionOverwrites.create(findRole.id, {
                SendMessages: true,
                ViewChannel: true,
                AttachFiles: true
            });
          }
        }
        
        const jumpRow = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setURL(`https://discord.com/channels/${message.guild.id}/${c.id}`)
              .setLabel(this.client.language.buttons.go_ticket)
              .setStyle(ButtonStyle.Link)
          );
  
        if(message.type == InteractionType.ApplicationCommand) {
          message.reply({ embeds: [this.client.embedBuilder(this.client, member.user, this.client.embeds.title, language.ticket.ticket_created
            .replace("<channel>", `<#${c.id}>`)
            .replace("<reason>", `${reason}`)
            .replace("<user>", member), this.client.embeds.success_color)], components: [jumpRow], flags: this.client.cmdConfig.new.ephemeral ? MessageFlags.Ephemeral : 0 });
        } else if(message.type == InteractionType.MessageComponent) {
          message.followUp({ embeds: [this.client.embedBuilder(this.client, member.user, this.client.embeds.title, language.ticket.ticket_created
            .replace("<channel>", `<#${c.id}>`)
            .replace("<reason>", `${reason}`)
            .replace("<user>", member), this.client.embeds.success_color)], components: [jumpRow], flags: MessageFlags.Ephemeral });
        } else {
          message.channel.send({ embeds: [this.client.embedBuilder(this.client, member.user, this.client.embeds.title, language.ticket.ticket_created
            .replace("<channel>", `<#${c.id}>`)
            .replace("<reason>", `${reason}`)
            .replace("<user>", member), this.client.embeds.success_color)], components: [jumpRow] }).then(m => setTimeout(() => m.delete(), 5000)); 
        }
        
        if(config.tickets.mention_author == true) c.send(`<@${member.id}>`).then(async(msg) => {
          setTimeout(async() => {
            if(msg) await msg.delete().catch((err) => { });
          }, 5000)
        });
        
        const buttonRow = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('closeTicket')
              .setLabel(this.client.language.buttons.close)
              .setEmoji(config.emojis.close || {})
              .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
              .setCustomId('claimTicket')
              .setLabel(this.client.language.buttons.claim)
              .setEmoji(this.client.config.emojis.claim || {})
              .setStyle(ButtonStyle.Success)
          );

        if(config.tickets.questions == true && config.tickets.questions_type == "MODAL" && this.client.config.tickets.category_status == false && separatedPanel.status == false) {
          buttonRow.addComponents(
            new ButtonBuilder()
              .setCustomId('ask_noCategory')
              .setLabel(this.client.language.buttons.answer_questions.replace("<page>", "1"))
              .setEmoji(config.emojis.answer_questions || {})
              .setStyle(ButtonStyle.Success),
          )
        }

        const embed = new EmbedBuilder()
          .setColor(this.client.embeds.general_color)
          .setTitle(this.client.embeds.title)
          .setDescription(this.client.embeds.ticket_message.replace("<user>", member)
            .replace("<reason>", `${reason}`));
            
        if(config.tickets.category_status == true) {
          if(this.client.embeds.select_category.description)
            embed.setDescription(this.client.embeds.select_category.description);
          
          let field = this.client.embeds.select_category.fields;
          for(let i = 0; i < this.client.embeds.select_category.fields.length; i++) {
            embed.addFields([{ name: field[i].title, value: field[i].description }])
          }
        }
        if(this.client.embeds.ticket.footer) embed.setFooter({ text: this.client.embeds.ticket.footer, iconURL: this.client.user.displayAvatarURL({ size: 1024, dynamic: true }) }).setTimestamp();
        if(this.client.embeds.ticket.image.enabled == true) embed.setImage(this.client.embeds.ticket.image.url);
        if(this.client.embeds.ticket.thumbnail.enabled == true) embed.setThumbnail(this.client.embeds.ticket.thumbnail.url);

        let msg = await c.send({ embeds: [embed], components: componentList(buttonRow) });

        if(config.tickets.questions == true && this.client.config.tickets.category_status == false && separatedPanel.status == false && config.tickets.questions_type == "MODAL") {
          startCollector(this.client, "noCategory", c, msg, member);
        } else if(config.tickets.questions == true && this.client.config.tickets.category_status == false && config.tickets.questions_type == "CHAT") {
          await chatAskQuestions(this.client, message.member, c, this.client.config.tickets.questionsList);
        }

        if(separatedPanel.status == true) {
          let ca = this.client.categories.find((cat) => cat.id.toLowerCase() == separatedPanel.cat_id.toLowerCase());
          if(!ca) {
            message.followUp({ embeds: [this.client.embedBuilder(this.client, member.user, this.client.embeds.title, language.ticket.invalid_panel, this.client.embeds.error_color)], flags: MessageFlags.Ephemeral });
            this.client.utils.sendError("Ticket Category with such ID " + ca.id + " couldn't be found (Separated Panels).");
            return;
          }

          if(separatedPanel.subcategory) {
            let subCategory = ca.subcategories.find((sub) => sub.id == separatedPanel.subcategory);

            embed.setDescription(this.client.embeds.select_subcategory.description
              .replace("<subcategories>", ca.subcategories.map((x) => `${x.emoji} - ${x.label}`).join("\n")));
            let field = this.client.embeds.select_subcategory.fields;
            for(let i = 0; i < this.client.embeds.select_subcategory.fields.length; i++) {
              embed.addFields([{ name: field[i].title, value: field[i].description
                .replace("<subcategories>", ca.subcategories.map((x) => `${x.emoji} - ${x.label}`).join("\n")) }])
            }
  
            msg.edit({ embeds: [embed], components: componentList(buttonRow) });

            await ticketSubCategory(this.client, { message, msg, member, embed, interaction: message }, componentList, reason,
              { buttonRow, subRow: null }, null, ca, subCategory, c);
          } else {
            await ticketCategory(this.client, { message, msg, member, embed, interaction: message }, componentList, reason, { buttonRow }, null, ca, c, true);
          }
        }

        await this.client.utils.serverLogs(this.client, {
          date: new Date().toLocaleString("en-GB"),
          author_id: member.user.id,
          author: member.user.username,
          user_id: null,
          user: null,
          channel_id: `${c.id}`,
          channel_name: `${c.name}`,
          ticketId: ticketId,
          message: `ticket_create`
        });

        if(this.client.config.tickets.category_status == false || separatedPanel.status == true) return;
        await this.client.database.usersData().set(`${member.id}.choosingCategory`, true);

        setTimeout(async() => {
          await this.client.database.usersData().delete(`${member.id}.choosingCategory`);
        }, 5 * 60000);

        const options = [];
        this.client.categories.forEach(c => {
          let catSelOption = {
            label: c.name,
            value: c.id, 
            description: c.placeholder != "" ? c.placeholder : ""
          }

          if(c.emoji) catSelOption["emoji"] = c.emoji;
          options.push(catSelOption);
        });
        
        let sMenu = new StringSelectMenuBuilder()
          .setCustomId("categorySelect")
          .setPlaceholder(config.tickets.select_placeholder)
          .addOptions(options);
  
        let row = new ActionRowBuilder()
          .addComponents(sMenu);

        msg.edit({ embeds: [embed], components: componentList(buttonRow, row) });
        
        const filter = (interaction) => interaction.customId == "categorySelect" && interaction.user.id === member.id;
        const rCollector = msg.createMessageComponentCollector({ filter, componentType: ComponentType.StringSelect, time: this.client.config.tickets.no_select_delete * 1000 });
        
        let claimed = false;
              
        rCollector.on("collect", async (i) => {
          await i.deferUpdate();
          let value = i.values[0];
          claimed = true;

          const ca = this.client.categories.find((x) => x.id == value);

          if(ca) {
            if(ca.type == "SUBCATEGORY_PARENT") {
              rCollector.stop();
              const subCategories = [];
              ca.subcategories.forEach((x) => {
                let subCatSelOption = {
                  label: x.name,
                  value: x.id, 
                  description: x.placeholder != "" ? x.placeholder : ""
                };

                if(x.emoji) subCatSelOption["emoji"] = x.emoji;
                subCategories.push(subCatSelOption);
              });

              const subFilter = (interaction) => interaction.customId == "subCategorySelect" && interaction.user.id === member.id;
              const subCollector = msg.createMessageComponentCollector({ filter: subFilter, componentType: ComponentType.StringSelect, time: this.client.config.tickets.no_select_delete * 1000 });

              sMenu.setCustomId("subCategorySelect")
                .setOptions(subCategories)
        
              let subRow = new ActionRowBuilder()
                .setComponents(sMenu);

              embed.setDescription(this.client.embeds.select_subcategory.description
                .replace("<subcategories>", subCategories.map((x) => `${x.emoji} - ${x.label}`).join("\n")));
              let field = this.client.embeds.select_subcategory.fields;
              for(let i = 0; i < this.client.embeds.select_subcategory.fields.length; i++) {
                embed.addFields([{ name: field[i].title, value: field[i].description
                  .replace("<subcategories>", subCategories.map((x) => `${x.emoji} - ${x.label}`).join("\n")) }])
              }
    
              msg.edit({ embeds: [embed], components: componentList(buttonRow, subRow) });

              subCollector.on("collect", async(sel) => {
                await sel.deferUpdate();

                let subValue = sel.values[0];
                const subCategory = ca.subcategories.find((sub) => sub.id == subValue);
                await ticketSubCategory(this.client, { message, msg, member, embed, interaction: sel }, componentList, reason,
                  { buttonRow, subRow }, subCollector, ca, subCategory, c);
              });

              subCollector.on("end", async(collected, reason) => {
                if(claimed == true) return;
                if(reason != "time") return;
                await this.client.database.usersData().delete(`${member.id}.choosingCategory`);
      
                let ticketList = await this.client.database.usersData().get(`${member.id}.tickets`) || [];
                ticketList = ticketList.filter((x) => x.channel != c.id);
                await this.client.database.ticketsData().set(`${member.id}.tickets`, ticketList);
      
                setTimeout(async() => {
                  c.delete();
                }, 500);
              });
            } else {
              await ticketCategory(this.client, { message, msg, member, embed, interaction: i }, componentList, reason, { buttonRow, row }, rCollector, ca, c);
            }
          }
        });
        
        rCollector.on("end", async(collected, reason) => {
          if(claimed == true) return;
          if(reason != "time") return;
          await this.client.database.usersData().delete(`${member.id}.choosingCategory`);

          let ticketList = await this.client.database.usersData().get(`${member.id}.tickets`) || [];
          ticketList = ticketList.filter((x) => x.channel != c.id);
          await this.client.database.ticketsData().set(`${member.id}.tickets`, ticketList);

          setTimeout(async() => {
            c.delete();
          }, 500);
        });
      }).catch((err) => console.log(err));
  }
};

const startCollector = (client, category, channel, msg, member) => {
  if(client.config.tickets.lock_ticket == true) {
    channel.permissionOverwrites.edit(member.id, {
      SendMessages: false,
      ViewChannel: true,
      SendMessagesInThreads: false
    });
  }

  const questFilter = (btn) => btn.customId == `ask_${category}` && btn.user.id == member.id;
  channel.awaitMessageComponent({ questFilter, componentType: ComponentType.Button, time: client.config.tickets.question_idle * 1000 })
    .then(interaction => {})
    .catch(() => {
      let editActionRow = ActionRowBuilder.from(msg.components[0]);
      editActionRow.components.forEach((c) => {
        if(c.data.custom_id != "closeTicket" && c.data.custom_id != "claimTicket") c.setDisabled(true);
      });

      msg.edit({ embeds: [msg.embeds[0]], components: [editActionRow] }).catch((err) => { });
  })
}
