const Discord = require("discord.js");
const Event = require("../../structures/Events");
const claimCommand = require("../../commands/tickets/claim");
const closeCommand = require("../../commands/tickets/close");
const prevQuestion = new Discord.Collection();

module.exports = class InteractionCreate extends Event {
	constructor(...args) {
		super(...args);
	}

	async run(interaction) {
    const message = interaction.message;
    const user = interaction.user;
    const config = this.client.config;
    const language = this.client.language;

    let modalArr = [];
    let questModal;
    
    if(user.bot) return;
    if (interaction.type == Discord.InteractionType.ApplicationCommand) {
      const cmd = this.client.slashCommands.get(interaction.commandName);
      if (!cmd) return interaction.reply({ content: "> Error occured, please contact Bot Owner.", flags: Discord.MessageFlags.Ephemeral });

      interaction.member = interaction.guild.members.cache.get(interaction.user.id);
      
      if(!this.client.utils.hasPermissions(interaction, interaction.member, cmd.permissions) 
        && !this.client.utils.hasRole(this.client, interaction.guild, interaction.member, this.client.config.roles.bypass.permission)
        && !interaction.member.permissions.has("Administrator")) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.language.titles.error, this.client.language.general.no_perm, this.client.embeds.error_color)], flags: Discord.MessageFlags.Ephemeral });

      const args = [];
      for (let option of interaction.options.data) {
        if (option.type === Discord.ApplicationCommandOptionType.Subcommand) {
          if (option.name) args.push(option.name);
          option.options?.forEach((x) => {
            if (x.value) args.push(x.value);
          });
        } else if (option.value) args.push(option.value);
      }

      if(this.client.cmdConfig[cmd.name]) {
        let cmdConfig = this.client.cmdConfig[cmd.name];
        if(cmdConfig.enabled == false) {
          if(this.client.language.general.cmd_disabled != "") interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.general.cmd_disabled, this.client.embeds.error_color)] });
          return;
        }
        if(cmdConfig && cmdConfig.roles.length > 0 && !this.client.utils.hasRole(this.client, interaction.guild, interaction.member, this.client.config.roles.bypass.permission) && !interaction.member.permissions.has("Administrator")) {
          let cmdRoles = cmdConfig.roles.map((x) => this.client.utils.findRole(interaction.guild, x));
          if(!this.client.utils.hasRole(this.client, interaction.guild, interaction.member, cmdConfig.roles)) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.general.no_role.replace("<role>", cmdRoles.join(", ")), this.client.embeds.error_color)], flags: Discord.MessageFlags.Ephemeral });
        }
        let findCooldown = this.client.cmdCooldowns.find((c) => c.name == cmd.name && c.id == interaction.user.id);
        if(!this.client.utils.hasRole(this.client, interaction.guild, interaction.member, this.client.config.roles.bypass.cooldown, true) && !interaction.member.permissions.has("Administrator")) {
          if(findCooldown) {
            let time = this.client.utils.formatTime(findCooldown.expiring - Date.now());
            return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.general.cooldown.replace("<cooldown>", time), this.client.embeds.error_color)], flags: Discord.MessageFlags.Ephemeral });
          } else if(!findCooldown && this.client.cmdConfig[cmd.name].cooldown > 0) {
            let cooldown = {
              id: interaction.user.id,
              name: cmd.name,
              expiring: Date.now() + (this.client.cmdConfig[cmd.name].cooldown * 1000),
            };
    
            this.client.cmdCooldowns.push(cooldown);
    
            setTimeout(() => {
              this.client.cmdCooldowns.splice(this.client.cmdCooldowns.indexOf(cooldown), 1);
            }, this.client.cmdConfig[cmd.name].cooldown * 1000);
          }
        }
      }

      cmd.slashRun(interaction, args);
    }
    if (interaction.isButton()) {
      if(interaction.customId.startsWith("createTicket")) {
        await interaction.deferUpdate();
        let blackListed = false;
        let member = interaction.guild.members.cache.get(user.id);
        for(let i = 0; i < config.roles.blacklist.length; i++) {
          if(member.roles.cache.has(config.roles.blacklist[i])) blackListed = true;
        }
        if(blackListed == true) 
          return interaction.followUp({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.ticket.bl_role, this.client.embeds.error_color)], flags: Discord.MessageFlags.Ephemeral })
        if(config.users.blacklist.includes(user.id))
          return interaction.followUp({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.ticket.bl_user, this.client.embeds.error_color)], flags: Discord.MessageFlags.Ephemeral })
        const noCategory = new Discord.EmbedBuilder()
          .setTitle(this.client.embeds.title)
          .setDescription(this.client.language.ticket.no_category)
          .setFooter({ text: this.client.embeds.footer, iconURL: user.displayAvatarURL({ dynamic: true }) })
          .setTimestamp()
          .setColor(this.client.embeds.error_color);
  
        if(config.channels.tickets_category == "") 
          return interaction.followUp({ embeds: [noCategory], flags: Discord.MessageFlags.Ephemeral });

        const catId = interaction.customId.replace("createTicket_", "");

        let isSubCat = false;
        let findCategory = this.client.categories.find((c) => c.id.toLowerCase() == catId.toLowerCase());

        if(!findCategory) {
          findCategory = this.client.categories.map((c) => {
            const subSearch = c.subcategories?.find((sc) => sc.id.toLowerCase() == catId.toLowerCase());
            if(subSearch)
              return subSearch;
          }).filter(Boolean)?.[0];
          if(findCategory) isSubCat = true;
        }

        if(findCategory?.type == "SUBCATEGORY_PARENT") {
          const options = [];
          findCategory.subcategories.forEach(c => {
            options.push({
              label: c.name,
              value: c.id, 
              emoji: c.emoji || {},
              description: c.placeholder != "" ? c.placeholder : ""
            });
          });
          
          let sMenu = new Discord.StringSelectMenuBuilder()
            .setCustomId("instant_subCategory")
            .setPlaceholder(config.tickets.select_placeholder)
            .addOptions(options);
    
          let row = new Discord.ActionRowBuilder()
            .addComponents(sMenu);

          const selSubcategory = new Discord.EmbedBuilder()
            .setTitle(this.client.embeds.title)
            .setColor(this.client.embeds.general_color)

          selSubcategory.setDescription(this.client.embeds.select_subcategory.description
            .replace("<subcategories>", options.map((x) => `${x.emoji} - ${x.label}`).join("\n")));
          let field = this.client.embeds.select_subcategory.fields;
          for(let i = 0; i < this.client.embeds.select_subcategory.fields.length; i++) {
            selSubcategory.addFields([{ name: field[i].title, value: field[i].description
              .replace("<subcategories>", options.map((x) => `${x.emoji} - ${x.label}`).join("\n")) }])
          }
          
          if(this.client.embeds.ticket.footer) selSubcategory.setFooter({ text: this.client.embeds.ticket.footer, iconURL: this.client.user.displayAvatarURL({ size: 1024, dynamic: true }) }).setTimestamp();
          if(this.client.embeds.ticket.image.enabled == true) selSubcategory.setImage(this.client.embeds.ticket.image.url);
          if(this.client.embeds.ticket.thumbnail.enabled == true) selSubcategory.setThumbnail(this.client.embeds.ticket.thumbnail.url);

          await interaction.followUp({ embeds: [selSubcategory], components: [row], flags: Discord.MessageFlags.Ephemeral, fetchReply: true })
          const filter = (i) => i.customId == "instant_subCategory" && i.user.id == interaction.user.id;
          const collector = await interaction.channel.createMessageComponentCollector({ filter, time: config.tickets.no_select_delete * 1000, componentType: Discord.ComponentType.SelectMenu, max: 1, maxComponents: 1, maxUsers: 1 });

          collector.on("collect", async(i) => {
            collector.stop("collected");
            await i.deferUpdate();
            let selSub = i.values[0];
            this.client.emit("ticketCreate", interaction, member, "No Reason", {
              status: true,
              cat_id: catId,
              subcategory: selSub
            });
          });

          collector.on("end", async(collected, reason) => { });            
        } else {
          if(isSubCat == true) {
            const findParent = this.client.categories.find((c) => c.subcategories?.find((sc) => sc.id.toLowerCase() == catId.toLowerCase()));
            this.client.emit("ticketCreate", interaction, member, "No Reason", {
              status: interaction.customId.includes("_"),
              cat_id: findParent.id,
              subcategory: findCategory.id
            });
          } else {
            this.client.emit("ticketCreate", interaction, member, "No Reason", {
              status: interaction.customId.includes("_"),
              cat_id: interaction.customId.includes("_") ? catId : 'n/a'
            });
          }
        }
      }

      if(interaction.customId == "delete_ticket") {
        await interaction.deferUpdate();
        interaction.followUp({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.ticket.ticket_deleted, this.client.embeds.general_color)] });
        setTimeout(async() => {
          await interaction.channel.delete().catch((err) => {});
        }, this.client.config.tickets.delete_after * 1000);
      }
  
      if(interaction.customId == "closeTicket" && interaction.user.bot == false) {
        const cmd = this.client.slashCommands.get("close");
        const cmdConfig = this.client.cmdConfig["close"];
        if(!this.client.utils.hasPermissions(interaction, interaction.member, cmdConfig.permissions) && !this.client.utils.hasRole(this.client, interaction.guild, interaction.member, this.client.config.roles.bypass.permission)) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.language.titles.error, this.client.language.general.no_perm, this.client.embeds.error_color)], flags: Discord.MessageFlags.Ephemeral });

        if(cmdConfig && cmdConfig.roles.length > 0 && !this.client.utils.hasRole(this.client, interaction.guild, interaction.member, this.client.config.roles.bypass.permission)) {
          let cmdRoles = cmdConfig.roles.map((x) => this.client.utils.findRole(interaction.guild, x));
          if(!this.client.utils.hasRole(this.client, interaction.guild, interaction.member, cmdConfig.roles)) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.general.no_role.replace("<role>", cmdRoles.join(", ")), this.client.embeds.error_color)], flags: Discord.MessageFlags.Ephemeral });
        }

        let close = new closeCommand(this.client);
        await close.slashRun(interaction);
      }

      if(interaction.customId == "claimTicket" && interaction.user.bot == false) {
        const cmdConfig = this.client.cmdConfig["claim"];
        if(!this.client.utils.hasPermissions(interaction, interaction.member, cmdConfig.permissions) && !this.client.utils.hasRole(this.client, interaction.guild, interaction.member, this.client.config.roles.bypass.permission)) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.language.titles.error, this.client.language.general.no_perm, this.client.embeds.error_color)], flags: Discord.MessageFlags.Ephemeral });

        if(cmdConfig && cmdConfig.roles.length > 0 && !this.client.utils.hasRole(this.client, interaction.guild, interaction.member, this.client.config.roles.bypass.permission)) {
          let cmdRoles = cmdConfig.roles.map((x) => this.client.utils.findRole(interaction.guild, x));
          if(!this.client.utils.hasRole(this.client, interaction.guild, interaction.member, cmdConfig.roles)) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.general.no_role.replace("<role>", cmdRoles.join(", ")), this.client.embeds.error_color)], flags: Discord.MessageFlags.Ephemeral });
        }

        let claim = new claimCommand(this.client);
        await claim.slashRun(interaction);
      }

      if(interaction.customId == "accept_quote") {
        let commission = await this.client.database.ticketsData().get(`${interaction.channel.id}.commission`);
        if(commission && commission?.status == "NO_STATUS") {
          if(commission.quoteList.find((x) => x.user == interaction.user.id) || commission.user != interaction.user.id) return interaction.deferUpdate();
          let commissionMessage = commission.quoteList.find((m) => m.messageId == interaction.message.id);
          if(!commissionMessage) return interaction.deferUpdate();

          const commissionUser = this.client.users.cache.get(commissionMessage.user);

          interaction.channel.permissionOverwrites.create(commissionMessage.user, {
            SendMessages: true,
            ViewChannel: true
          });

          let bulkArr = commission.quoteList.map((x) => x.messageId);

          let quoteEmbed = new Discord.EmbedBuilder()
            .setColor(this.client.embeds.service.quote_accepted.color);
        
          if(this.client.embeds.service.quote_accepted.title) quoteEmbed.setTitle(this.client.embeds.service.quote_accepted.title);
          
          if(this.client.embeds.service.quote_accepted.description) quoteEmbed.setDescription(this.client.embeds.service.quote_accepted.description.replace("<price>", commissionMessage.basePrice)
            .replace("<priceWithTax>", commissionMessage.price)
            .replace("<user>", commissionUser.username)
            .replace("<currency>", this.client.config.general.currency)
            .replace("<currencySymbol>", this.client.config.general.currency_symbol)
            .replace("<timeFrame>", commissionMessage.timeFrame || this.client.language.service.commission.no_time_frame)
            .replace("<notes>", commissionMessage.notes || this.client.language.service.commission.no_notes));
          
          let field = this.client.embeds.service.quote_accepted.fields;
          for(let i = 0; i < this.client.embeds.service.quote_accepted.fields.length; i++) {
            quoteEmbed.addFields([{ name: field[i].title.replace("<currency>", this.client.config.general.currency), value: field[i].description.replace("<price>", commissionMessage.basePrice)
              .replace("<priceWithTax>", commissionMessage.price)
              .replace("<user>", commissionUser.username)
              .replace("<currency>", this.client.config.general.currency)
              .replace("<currencySymbol>", this.client.config.general.currency_symbol)
              .replace("<timeFrame>", commissionMessage.timeFrame || this.client.language.service.commission.no_time_frame)
              .replace("<notes>", commissionMessage.notes || this.client.language.service.commission.no_notes), inline: this.client.embeds.service.quote_accepted.inline }])
          }
          
          if(this.client.embeds.service.quote_accepted.footer == true) quoteEmbed.setFooter({ text: message.author.username, iconURL: message.author.displayAvatarURL() }).setTimestamp();
          if(this.client.embeds.service.quote_accepted.thumbnail == true) quoteEmbed.setThumbnail(user.displayAvatarURL());
          
          interaction.reply({ embeds: [quoteEmbed] });
          
          commission.status = "QUOTE_ACCEPTED"
          commission.quoteList = [commissionMessage];
          
          let commissionsChannel = this.client.utils.findChannel(interaction.guild, commission.commChannelId);
          if(commissionsChannel) {
            let commFetchedMsg = await commissionsChannel.messages.fetch({ message: commission.commMessageId });
            if(commFetchedMsg?.hasThread) {
              await commFetchedMsg.thread.delete().catch((err) => {});
            }
            await commFetchedMsg.delete();
          }
          
          interaction.channel.bulkDelete(bulkArr).catch((err) => {});
          await this.client.database.ticketsData().set(`${interaction.channel.id}.commission`, commission);
        }
      }

      if(interaction.customId == "decline_quote") {
        let commission = await this.client.database.ticketsData().get(`${interaction.channel.id}.commission`);
        if(commission && commission?.status == "NO_STATUS") {
          if(commission.quoteList.find((x) => x.user == interaction.user.id) || commission.user != interaction.user.id) return interaction.deferUpdate();
          let commissionMessage = commission.quoteList.find((m) => m.messageId == interaction.message.id);
          if(!commissionMessage) return interaction.deferUpdate();

          const commissionUser = this.client.users.cache.get(commissionMessage.user);

          let declineInput = new Discord.ActionRowBuilder()
            .addComponents(
              new Discord.TextInputBuilder()
                .setCustomId("decline_quote_reason")
                .setLabel(this.client.language.modals.labels.quote_decline)
                .setPlaceholder(this.client.language.modals.placeholders.quote_decline)
                .setRequired(true)
                .setStyle(Discord.TextInputStyle.Paragraph)
            );
          
          let quoteDecineModal = new Discord.ModalBuilder()
            .setTitle(this.client.language.titles.quote_decline_reason)
            .setCustomId("quote_decline_modal")
            .addComponents(declineInput);
            
          
          const filter = (i) => i.customId == 'quote_decline_modal' && i.user.id == interaction.user.id;
          let declineReason = "N/A";
          if(this.client.config.general.quote_decline_reason == true) {
            interaction.showModal(quoteDecineModal);
            await interaction.awaitModalSubmit({ filter, time: 240_000 }).then(async(md) => {
              declineReason = md.fields.getTextInputValue("decline_quote_reason");
              md.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.commission.quote_declined.replace("<freelancer>", commissionUser.username), this.client.embeds.success_color)], flags: Discord.MessageFlags.Ephemeral });
            });
          }

          let quoteEmbed = new Discord.EmbedBuilder()
            .setColor(this.client.embeds.service.quote_declined.color);
          
          if(this.client.embeds.service.quote_declined.title) quoteEmbed.setTitle(this.client.embeds.service.quote_declined.title);
          
          if(this.client.embeds.service.quote_declined.description) quoteEmbed.setDescription(this.client.embeds.service.quote_declined.description.replace("<price>", commissionMessage.basePrice)
            .replace("<priceWithTax>", commissionMessage.price)
            .replace("<freelancer>", commissionUser.username)
            .replace("<user>", interaction.user.username)
            .replace("<currency>", this.client.config.general.currency)
            .replace("<currencySymbol>", this.client.config.general.currency_symbol)
            .replace("<timeFrame>", commissionMessage.timeFrame || this.client.language.service.commission.no_time_frame)
            .replace("<reason>", declineReason)
            .replace("<notes>", commissionMessage.notes || this.client.language.service.commission.no_notes));
          
          let field = this.client.embeds.service.quote_declined.fields;
          for(let i = 0; i < this.client.embeds.service.quote_declined.fields.length; i++) {
            quoteEmbed.addFields([{ name: field[i].title.replace("<currency>", this.client.config.general.currency), value: field[i].description.replace("<price>", commissionMessage.basePrice)
              .replace("<priceWithTax>", commissionMessage.price)
              .replace("<freelancer>", commissionUser.username)
              .replace("<user>", interaction.user.username)
              .replace("<currency>", this.client.config.general.currency)
              .replace("<currencySymbol>", this.client.config.general.currency_symbol)
              .replace("<timeFrame>", commissionMessage.timeFrame || this.client.language.service.commission.no_time_frame)
              .replace("<reason>", declineReason)
              .replace("<notes>", commissionMessage.notes || this.client.language.service.commission.no_notes), inline: this.client.embeds.service.quote_declined.inline }])
          }
          
          if(this.client.embeds.service.quote_declined.footer == true) quoteEmbed.setFooter({ text: message.author.username, iconURL: message.author.displayAvatarURL() }).setTimestamp();
          if(this.client.embeds.service.quote_declined.thumbnail == true) quoteEmbed.setThumbnail(user.displayAvatarURL());
  
          let indexOfQuote = commission.quoteList.indexOf(commissionMessage);
          commissionMessage.declined = true;

          commission.quoteList[indexOfQuote] = commissionMessage;
  
          await interaction.message.delete();
  
          let commissionsChannel = this.client.utils.findChannel(interaction.guild, commission.commChannelId);
          if(commissionsChannel) {
            let commFetchedMsg = await commissionsChannel.messages.fetch({ message: commission.commMessageId });
            if(commFetchedMsg)
              commFetchedMsg.thread.send({ embeds: [quoteEmbed] });
          }
        }
      }

      if(interaction.customId.startsWith("commission_") && interaction.guild) {
        const commChannel = this.client.channels.cache.get(interaction.customId.split("_")[1]);
        if(!commChannel) return this.client.utils.sendError("Commission Ticket Channel couldn't be found.");

        let commPrice = new Discord.ActionRowBuilder()
          .addComponents(
            new Discord.TextInputBuilder()
            .setCustomId("commission_price")
            .setLabel(language.modals.labels.comm_price)
            .setPlaceholder(language.modals.placeholders.comm_price)
            .setMinLength(1)
            .setRequired(true)
            .setStyle(Discord.TextInputStyle.Short)
          );
        
        let commTime = new Discord.ActionRowBuilder()
          .addComponents(
            new Discord.TextInputBuilder()
            .setCustomId("commission_time")
            .setLabel(language.modals.labels.comm_time)
            .setPlaceholder(language.modals.placeholders.comm_time)
            .setMinLength(1)
            .setRequired(true)
            .setStyle(Discord.TextInputStyle.Short)
          );
        
        let commNote = new Discord.ActionRowBuilder()
          .addComponents(
            new Discord.TextInputBuilder()
            .setCustomId("commission_note")
            .setLabel(language.modals.labels.comm_note)
            .setPlaceholder(language.modals.placeholders.comm_note)
            .setStyle(Discord.TextInputStyle.Paragraph)
          );

        let commissionModal = new Discord.ModalBuilder()
          .setTitle(language.titles.quote)
          .setCustomId("commission_modal")
          .addComponents([commPrice, commTime, commNote]);

        interaction.showModal(commissionModal);

        const filter = (i) => i.customId == 'commission_modal' && i.user.id == interaction.user.id;
        interaction.awaitModalSubmit({ filter, time: 300_000 }).then(async(md) => {
          await md.deferUpdate();
          
          const price = md.fields.getTextInputValue("commission_price");
          const taxPrice = this.client.utils.priceWithTax(this.client, Number(price));
          const timeFrame = md.fields.getTextInputValue("commission_time");
          const notes = md.fields.getTextInputValue("commission_note");

          let commission = await this.client.database.ticketsData().get(`${commChannel.id}.commission`);
          if(!commission || commission?.status != "NO_STATUS") return md.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.commission.not_commission, this.client.embeds.error_color)], flags: this.client.cmdConfig.quote.ephemeral ? Discord.MessageFlags.Ephemeral : 0 });

          const userData = await this.client.database.usersData().get(`${interaction.user.id}`) || {};

          let embed = new Discord.EmbedBuilder()
            .setColor(this.client.embeds.service.quote.color);
          if(this.client.embeds.service.quote.title) embed.setTitle(this.client.embeds.service.quote.title);

          let history = userData.reviews?.filter((r) => r.rating) || [];
          let bio = userData.bio || "N/A";
          let availableHours = userData.availableHours || "N/A";
          let portfolio = userData.portfolio || "N/A";

          let totalRating = 0;
          for(let i = 0; i < history.length; i++) {
            totalRating += parseInt(history[i].rating);
          }

          totalRating = Math.floor(totalRating/history.length) || 0;

          if(this.client.embeds.service.quote.description) embed.setDescription(this.client.embeds.service.quote.description.replace("<price>", price)
            .replace("<priceWithTax>", taxPrice)
            .replace("<user>", interaction.user.username)
            .replace("<userId>", interaction.user.id)
            .replace("<bio>", bio)
            .replace("<portfolio>", portfolio)
            .replace("<availableHours>", availableHours)
            .replace("<currency>", this.client.config.general.currency)
            .replace("<currencySymbol>", this.client.config.general.currency_symbol)
            .replace("<timeFrame>", timeFrame || this.client.language.service.commission.no_time_frame)
            .replace("<notes>", notes || this.client.language.service.commission.no_notes)
            .replace("<rating>", totalRating > 0 ? config.emojis.review.star.repeat(totalRating) : "N/A"));

          let field = this.client.embeds.service.quote.fields;
          for(let i = 0; i < this.client.embeds.service.quote.fields.length; i++) {
            embed.addFields([{ name: field[i].title.replace("<currency>", this.client.config.general.currency), value: field[i].description.replace("<price>", price)
              .replace("<priceWithTax>", taxPrice)
              .replace("<user>", interaction.user.username)
              .replace("<userId>", interaction.user.id)
              .replace("<bio>", bio)
              .replace("<portfolio>", portfolio)
              .replace("<availableHours>", availableHours)
              .replace("<currency>", this.client.config.general.currency)
              .replace("<currencySymbol>", this.client.config.general.currency_symbol)
              .replace("<timeFrame>", timeFrame || this.client.language.service.commission.no_time_frame)
              .replace("<notes>", notes || this.client.language.service.commission.no_notes)
              .replace("<rating>", totalRating > 0 ? config.emojis.review.star.repeat(totalRating) : "N/A"), inline: this.client.embeds.service.quote.inline }])
          }

          if(this.client.embeds.service.quote.footer == true ) embed.setFooter({ text: interaction.user.username, iconURL: interaction.user.displayAvatarURL() }).setTimestamp();
          if(this.client.embeds.service.quote.thumbnail == true) embed.setThumbnail(user.displayAvatarURL());
            
          let bttnRow = new Discord.ActionRowBuilder().addComponents(
            new Discord.ButtonBuilder()
              .setLabel(this.client.language.buttons.quote)
              .setStyle(Discord.ButtonStyle.Success)
              .setEmoji(this.client.config.emojis.quote || {})
              .setCustomId("accept_quote")
          );

          if(this.client.config.general.buttons.decline_quote == true)
            bttnRow.addComponents(
              new Discord.ButtonBuilder()
                .setLabel(this.client.language.buttons.decline_quote)
                .setStyle(Discord.ButtonStyle.Danger)
                .setEmoji(this.client.config.emojis.decline_quote || {})
                .setCustomId("decline_quote")
            );

          await md.followUp({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.commission.quote_sent, this.client.embeds.success_color)], flags: Discord.MessageFlags.Ephemeral });

          await commChannel.send({ content: `<@!${commission.user}>`, embeds: [embed], components: [bttnRow] }).then(async(msg) => {
            commission.quoteList.push({
              user: interaction.user.id,
              messageId: msg.id,
              price: taxPrice,
              basePrice: price,
              timeFrame,
              notes,
              declined: false
            });

            await this.client.database.ticketsData().set(`${commChannel.id}.commission`, commission);
          });

        }).catch((err) => { });
      }

      if(interaction.customId.startsWith("withdraw_") && interaction.guild) {
        let request = await this.client.database.guildData().get(`${interaction.guild.id}.withdrawRequests`) || [];
        request = request.find((x) => x.id == interaction.message.id);
        if(request) {
          if(request.user == interaction.user.id) return interaction.deferUpdate();
          let wType = interaction.customId.split("_")[1];
          if(wType == "yes") {
            const userData = await this.client.database.usersData().get(`${request.user}`) || {};
            const balance = userData.balance || 0;
            const reqUser = this.client.users.cache.get(request.user);
            let mail = userData.paypal || "";
            // if(request.amount > balance) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.invalid_withdraw, this.client.embeds.error_color)], flags: Discord.MessageFlags.Ephemeral });
            if(!mail) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.no_mail, this.client.embeds.error_color)], flags: this.client.cmdConfig.withdraw.ephemeral ? Discord.MessageFlags.Ephemeral : 0 });

            interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.withdraw_accepted.replace("<user>", `<@!${request.user}>`).replace("<amount>", request.amount), this.client.embeds.success_color)], flags: Discord.MessageFlags.Ephemeral });
            await reqUser.send({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.withdraw_accepted_dm.replace("<acceptedBy>", interaction.user).replace("<user>", `<@!${request.user}>`).replace("<amount>", request.amount), this.client.embeds.success_color)] }).catch((err) => {
              console.error("User's DM Closed");
            });

            interaction.message.delete();

            let withdrawAccepted = new Discord.EmbedBuilder()
              .setColor(this.client.embeds.service.withdraw_accepted.color);

            if(this.client.embeds.service.withdraw_accepted.title) withdrawAccepted.setTitle(this.client.embeds.service.withdraw_accepted.title);
            let field = this.client.embeds.service.withdraw_accepted.fields;
            for(let i = 0; i < this.client.embeds.service.withdraw_accepted.fields.length; i++) {
            withdrawAccepted.addFields([{ name: field[i].title.replace("<currency>", this.client.config.general.currency), value: field[i].description.replace("<user>", interaction.user.username)
              .replace("<freelancer>", reqUser.username)
              .replace("<amount>", request.amount)
              .replace("<currency>", this.client.config.general.currency)
              .replace("<currencySymbol>", this.client.config.general.currency_symbol)
              .replace("<mail>", mail)
              .replace("<balance>", Number(balance).toFixed(0)), inline: this.client.embeds.service.withdraw_accepted.inline }])
            }

            if(this.client.embeds.service.withdraw_accepted.footer == true) withdrawAccepted.setFooter({ text: interaction.user.username, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) }).setTimestamp();
            if(this.client.embeds.service.withdraw_accepted.thumbnail == true) withdrawAccepted.setThumbnail(interaction.guild.iconURL());

            if(this.client.embeds.service.withdraw_accepted.description) withdrawAccepted.setDescription(this.client.embeds.service.withdraw_accepted.description.replace("<user>", interaction.user.username)
              .replace("<freelancer>", reqUser.username)
              .replace("<amount>", request.amount)
              .replace("<currency>", this.client.config.general.currency)
              .replace("<currencySymbol>", this.client.config.general.currency_symbol)
              .replace("<mail>", mail)
              .replace("<balance>", Number(balance).toFixed(0)));

            let withdrawRow = new Discord.ActionRowBuilder()
              .addComponents(
                new Discord.ButtonBuilder()
                  .setURL(`https://www.paypal.com/cgi-bin/webscr?&cmd=_xclick&business=${mail}&currency_code=${this.client.config.general.currency}&amount=${request.amount}&item_name=${encodeURIComponent(this.client.language.service.withdraw_reason.replace("<user>", interaction.user.username).trim())}&no_shipping=1`)
                  .setLabel(this.client.language.buttons.send_withdraw)
                  .setStyle(Discord.ButtonStyle.Link)
              );

            interaction.channel.send({ embeds: [withdrawAccepted], components: [withdrawRow] });

            await this.client.database.guildData().pull(`${interaction.guild.id}.withdrawRequests`, request);
          } else {
            const userData = await this.client.database.usersData().get(`${request.user}`) || {};
            const reqUser = this.client.users.cache.get(request.user);
            const balance = userData.balance || 0;
            let mail = userData.paypal || "";
            
            interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.withdraw_denied.replace("<user>", `<@!${request.user}>`).replace("<amount>", request.amount), this.client.embeds.success_color)], flags: Discord.MessageFlags.Ephemeral });
            await reqUser.send({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.withdraw_denied_dm.replace("<acceptedBy>", interaction.user).replace("<user>", `<@!${request.user}>`).replace("<amount>", request.amount), this.client.embeds.success_color)] }).catch((err) => {
              console.error("User's DM Closed");
            });

            interaction.message.delete();

            let withdrawDenied = new Discord.EmbedBuilder()
              .setColor(this.client.embeds.service.withdraw_denied.color);

            if(this.client.embeds.service.withdraw_denied.title) withdrawDenied.setTitle(this.client.embeds.service.withdraw_denied.title);
            let field = this.client.embeds.service.withdraw_denied.fields;
            for(let i = 0; i < this.client.embeds.service.withdraw_denied.fields.length; i++) {
              withdrawDenied.addFields([{ name: field[i].title.replace("<currency>", this.client.config.general.currency), value: field[i].description.replace("<user>", interaction.user.username)
                .replace("<freelancer>", reqUser.username)
                .replace("<amount>", request.amount)
                .replace("<currency>", this.client.config.general.currency)
                .replace("<currencySymbol>", this.client.config.general.currency_symbol)
                .replace("<mail>", mail)
                .replace("<balance>", Number(balance).toFixed(0)), inline: this.client.embeds.service.withdraw_denied.inline }])
            }

            if(this.client.embeds.service.withdraw_denied.footer == true) withdrawDenied.setFooter({ text: interaction.user.username, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) }).setTimestamp();
            if(this.client.embeds.service.withdraw_denied.thumbnail == true) withdrawDenied.setThumbnail(interaction.guild.iconURL());

            if(this.client.embeds.service.withdraw_denied.description) withdrawDenied.setDescription(this.client.embeds.service.withdraw_denied.description.replace("<user>", interaction.user.username)
              .replace("<freelancer>", reqUser.username)
              .replace("<amount>", request.amount)
              .replace("<currency>", this.client.config.general.currency)
              .replace("<currencySymbol>", this.client.config.general.currency_symbol)
              .replace("<mail>", mail)
              .replace("<balance>", Number(balance).toFixed(0)));

            interaction.channel.send({ embeds: [withdrawDenied] });

            await this.client.database.usersData().add(`${request.user}.balance`, request.amount);
            await this.client.database.guildData().pull(`${interaction.guild.id}.withdrawRequests`, request);
          }
        }
      }

      if(interaction.customId == "ask_noCategory") {
        let catSelected = this.client.categories.find((ct) => ct.id.toLowerCase() == interaction.customId.replace("ask_", "").toLowerCase());
        if(!catSelected) {
          catSelected = this.client.categories.filter((x) => x.type == "SUBCATEGORY_PARENT" && x.subcategories);
          catSelected = catSelected.map((x) => {
            return x.subcategories.find((a) => a.id.toLowerCase() == interaction.customId.replace("ask_", "").toLowerCase())
          })[0];
        }

        let questionsList = this.client.config.tickets.questionsList;

        if(questionsList.length == 0) return;
        const chunkSize = 5;
        const arrOfChunks = [];

        for (let i = 0; i < questionsList.length; i += chunkSize) {
          const chunk = questionsList.slice(i, i + chunkSize);
          arrOfChunks.push(chunk)
        }

        for (let i = 0; i < arrOfChunks.length; i++) {
          modalArr.push(arrOfChunks[i].map((x) => {
            let questionIndex = questionsList.indexOf(questionsList.find((q) => q.name == x.name));
            let modalData = new Discord.ActionRowBuilder().addComponents(
              new Discord.TextInputBuilder()
              .setLabel(x.name)
              .setStyle(Discord.TextInputStyle.Paragraph)
              .setMaxLength(2048)
              .setCustomId(`modalQuestion_${questionIndex}`)
              .setPlaceholder(x.question)
              .setRequired(x.required)
            );

            return modalData;
          }))
        }

        await this.client.database.ticketsData().set(`${interaction.channel.id}.listOfQuestions`, {
          list: questionsList,
          ticketCategory: catSelected,
          modalArr
        });

        const channelData = await this.client.database.ticketsData().get(`${interaction.channel.id}`);
        let startingPage = channelData.questionPage || 1;
        
        questModal = new Discord.ModalBuilder()
          .setTitle(this.client.language.titles.questions.replace("<page>", startingPage).replace("<max>", modalArr.length))
          .setComponents(modalArr[startingPage - 1])
          .setCustomId("askQuestions_modal");
        
        if (channelData.questionsAnswered == true) {
          let editActionRow = Discord.ActionRowBuilder.from(interaction.message.components[0]);
          editActionRow.components.forEach((c) => {
            if(c.data.custom_id != "closeTicket" && c.data.custom_id != "claimTicket") c.setStyle(Discord.ButtonStyle.Secondary)
              .setLabel(this.client.language.buttons.answered_all)
              .setDisabled(true);
          });
          interaction.message.edit({ embeds: [interaction.message.embeds[0]], components: [editActionRow] }).catch((err) => { });
          return;
        }

        interaction.showModal(questModal);
      } else if(interaction.customId.startsWith("ask_") && interaction.customId.split("_")[1] != "noCategory") {
        let catSelected = this.client.categories.find((ct) => ct.id.toLowerCase() == interaction.customId.replace("ask_", "").toLowerCase());
        if(!catSelected) {
          catSelected = this.client.categories.filter((x) => x.type == "SUBCATEGORY_PARENT" && x.subcategories);
          catSelected = catSelected.map((x) => {
            return x.subcategories.find((a) => a.id.toLowerCase() == interaction.customId.replace("ask_", "").toLowerCase())
          }).filter(Boolean)[0];
        }

        let questionsList = catSelected.questionsList;

        if(questionsList.length == 0) return;
        const chunkSize = 5;
        const arrOfChunks = [];

        for (let i = 0; i < questionsList.length; i += chunkSize) {
          const chunk = questionsList.slice(i, i + chunkSize);
          arrOfChunks.push(chunk)
        }

        for (let i = 0; i < arrOfChunks.length; i++) {
          modalArr.push(arrOfChunks[i].map((x) => {
            let questionIndex = questionsList.indexOf(questionsList.find((q) => q.name == x.name));
            let modalData = new Discord.ActionRowBuilder().addComponents(
              new Discord.TextInputBuilder()
              .setLabel(x.name)
              .setStyle(Discord.TextInputStyle.Paragraph)
              .setMaxLength(2048)
              .setCustomId(`modalQuestion_${questionIndex}`)
              .setPlaceholder(x.question)
              .setRequired(x.required)
            );

            return modalData;
          }))
        }

        await this.client.database.ticketsData().set(`${interaction.channel.id}.listOfQuestions`, {
          list: questionsList,
          ticketCategory: catSelected,
          modalArr
        });

        const channelData = await this.client.database.ticketsData().get(`${interaction.channel.id}`);
        let startingPage = channelData.questionPage || 1;
        
        questModal = new Discord.ModalBuilder()
          .setTitle(this.client.language.titles.questions.replace("<page>", startingPage).replace("<max>", modalArr.length))
          .setComponents(modalArr[startingPage - 1])
          .setCustomId("askQuestions_modal");

        if (channelData.questionsAnswered == true) {
          let editActionRow = Discord.ActionRowBuilder.from(interaction.message.components[0]);
          editActionRow.components.forEach((c) => {
            if(c.data.custom_id != "closeTicket" && c.data.custom_id != "claimTicket") c.setStyle(Discord.ButtonStyle.Secondary)
              .setLabel(this.client.language.buttons.answered_all)
              .setDisabled(true);
          });
          interaction.message.edit({ embeds: [interaction.message.embeds[0]], components: [editActionRow] }).catch((err) => { });
          return;
        }

        interaction.showModal(questModal);
      }
  
      // Suggestion Vote
      if(interaction.customId.startsWith("vote_") && interaction.guild) {
        let suggestionData = await this.client.database.suggestionsData().get(`${interaction.message.id}`);
        if(suggestionData) {
          let voteType = interaction.customId.split("_")[1].toLowerCase();
          if (voteType == "yes") {
            if (suggestionData.voters.some((u) => u.user == interaction.user.id)) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.general.suggestions.already_voted, this.client.embeds.error_color)], flags: Discord.MessageFlags.Ephemeral });
            let newData = {
              text: suggestionData.text,
              date: suggestionData.date,
              decision: suggestionData.decision,
              author: suggestionData.author,
              yes: parseInt(suggestionData.yes) + 1,
              no: parseInt(suggestionData.no),
              voters: suggestionData.voters.concat({ user: interaction.user.id, type: "yes" }),
              status: 'none',
            };
            await this.client.database.suggestionsData().set(`${interaction.message.id}`, newData);
            await interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.general.suggestions.vote_yes, this.client.embeds.success_color)], flags: Discord.MessageFlags.Ephemeral });
            setTimeout(async() => {
              await this.client.utils.updateSuggestionEmbed(this.client, interaction);
            }, 250);
          } else if (voteType == "no") {
            if (suggestionData.voters.some((u) => u.user == interaction.user.id)) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.general.suggestions.already_voted, this.client.embeds.error_color)], flags: Discord.MessageFlags.Ephemeral });
            let newData = {
              text: suggestionData.text,
              date: suggestionData.date,
              decision: suggestionData.decision,
              author: suggestionData.author,
              yes: parseInt(suggestionData.yes),
              no: parseInt(suggestionData.no) + 1,
              voters: suggestionData.voters.concat({ user: interaction.user.id, type: "no" }),
              status: 'none',
            };
            await this.client.database.suggestionsData().set(`${interaction.message.id}`, newData);
            await interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.general.suggestions.vote_no, this.client.embeds.success_color)], flags: Discord.MessageFlags.Ephemeral });
            setTimeout(async() => {
              await this.client.utils.updateSuggestionEmbed(this.client, interaction);
            }, 250);
          } else if (voteType == "reset") {
            if (!suggestionData.voters.some((u) => u.user == interaction.user.id)) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.general.suggestions.not_voted, this.client.embeds.error_color)], flags: Discord.MessageFlags.Ephemeral });
            let removeYes = suggestionData.voters.find((d) => d.type == "yes" && d.user == interaction.user.id);
            let removeNo = suggestionData.voters.find((d) => d.type == "no" && d.user == interaction.user.id);
  
            let newData = {
              text: suggestionData.text,
              date: suggestionData.date,
              decision: suggestionData.decision,
              author: suggestionData.author,
              yes: removeYes ? parseInt(suggestionData.yes) - 1 : parseInt(suggestionData.yes),
              no: removeNo ? parseInt(suggestionData.no) - 1 : parseInt(suggestionData.no),
              voters: suggestionData.voters.filter((v) => v.user != interaction.user.id),
              status: 'none',
            };
            await this.client.database.suggestionsData().set(`${interaction.message.id}`, newData);
            await interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.general.suggestions.vote_reset, this.client.embeds.success_color)], flags: Discord.MessageFlags.Ephemeral });
            setTimeout(async() => {
              await this.client.utils.updateSuggestionEmbed(this.client, interaction);
            }, 250);
          }
        }
      }

      if(interaction.customId.startsWith("commissionMessage_")) {
        const splitCustomId = interaction.customId.split("_");
        const commChannel = interaction.guild.channels.cache.get(splitCustomId[1]);
        const commission = await this.client.database.ticketsData().get(`${splitCustomId[1]}.commission`);

        if(commChannel) {
          let msgClientInput = new Discord.ActionRowBuilder()
            .addComponents(
              new Discord.TextInputBuilder()
                .setCustomId("msgclient_input")
                .setLabel(this.client.language.modals.labels.message_client)
                .setPlaceholder(this.client.language.modals.placeholders.message_client)
                .setMinLength(6)
                .setRequired(true)
                .setStyle(Discord.TextInputStyle.Paragraph)
            );
          
          let msgClientModal = new Discord.ModalBuilder()
            .setTitle(this.client.language.titles.message_client)
            .setCustomId("msgclient_modal")
            .addComponents(msgClientInput);
            
          interaction.showModal(msgClientModal);
          
          const filter = (i) => i.customId == 'msgclient_modal' && i.user.id == interaction.user.id;
          interaction.awaitModalSubmit({ filter, time: 240_000 }).then(async(md) => {
            let modalValue = md.fields.getTextInputValue("msgclient_input");
            
            const commRow = new Discord.ActionRowBuilder()
              .addComponents(
                new Discord.ButtonBuilder()
                  .setStyle(Discord.ButtonStyle.Secondary)
                  .setCustomId(`replyComm_${splitCustomId[1]}_${interaction.user.id}_${interaction.user.id}`)
                  .setLabel(this.client.language.buttons.reply_message)
                  .setEmoji(config.emojis.reply_commission || {})
              );

            prevQuestion.set(splitCustomId[1], modalValue);

            let msgClientEmbed = new Discord.EmbedBuilder()
              .setColor(this.client.embeds.service.message_client.color);
          
            if(this.client.embeds.service.message_client.title) msgClientEmbed.setTitle(this.client.embeds.service.message_client.title);
            
            if(this.client.embeds.service.message_client.description) msgClientEmbed.setDescription(this.client.embeds.service.message_client.description.replace("<message>", modalValue)
              .replace("<user>", interaction.user));
            
            let field = this.client.embeds.service.message_client.fields;
            for(let i = 0; i < this.client.embeds.service.message_client.fields.length; i++) {
              msgClientEmbed.addFields([{ name: field[i].title, value: field[i].description.replace("<message>", modalValue)
                .replace("<user>", interaction.user), inline: this.client.embeds.service.message_client.inline }])
            }
            
            if(this.client.embeds.service.message_client.footer == true) msgClientEmbed.setFooter({ text: interaction.user.username, iconURL: interaction.user.displayAvatarURL() }).setTimestamp();
            if(this.client.embeds.service.message_client.thumbnail == true) msgClientEmbed.setThumbnail(interaction.user.displayAvatarURL());

            md.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.commission.message_sent.replace("<user>", `<@!${commission.user}>`).replace("<channel>", commChannel), this.client.embeds.success_color)], flags: Discord.MessageFlags.Ephemeral });
            commChannel.send({ embeds: [msgClientEmbed], components: [commRow] });
          }).catch((err) => { });
        }
      }

      if(interaction.customId.startsWith("replyComm_")) {
        const splitCustomId = interaction.customId.split("_");
        const commChannel = this.client.channels.cache.get(splitCustomId[1]);
        const commission = await this.client.database.ticketsData().get(`${splitCustomId[1]}.commission`);
        const userReply = this.client.users.cache.get(splitCustomId[2]);
        const freelancerSender = this.client.users.cache.get(splitCustomId[3]);

        if(freelancerSender != userReply)
          return interaction.deferUpdate();
        if(commChannel) {
          let replyInput = new Discord.ActionRowBuilder()
            .addComponents(
              new Discord.TextInputBuilder()
                .setCustomId("replymsg_input")
                .setLabel(this.client.language.modals.labels.reply_comm)
                .setPlaceholder(this.client.language.modals.placeholders.reply_comm)
                .setMinLength(6)
                .setRequired(true)
                .setStyle(Discord.TextInputStyle.Paragraph)
            );
          
          let replyModal = new Discord.ModalBuilder()
            .setTitle(this.client.language.titles.reply_comm)
            .setCustomId("replymsg_modal")
            .addComponents(replyInput);
            
          interaction.showModal(replyModal);
          
          const filter = (i) => i.customId == 'replymsg_modal' && i.user.id == interaction.user.id;
          interaction.awaitModalSubmit({ filter, time: 240_000 })
            .then(async(md) => {
            const prevMessage = prevQuestion.get(splitCustomId[1]) || "N/A";
            let modalValue = md.fields.getTextInputValue("replymsg_input");
            
            let commReplyEmbed = new Discord.EmbedBuilder()
              .setColor(this.client.embeds.service.commission_reply.color);
          
            if(this.client.embeds.service.commission_reply.title) commReplyEmbed.setTitle(this.client.embeds.service.commission_reply.title);
            
            if(this.client.embeds.service.commission_reply.description) commReplyEmbed.setDescription(this.client.embeds.service.commission_reply.description.replace("<message>", modalValue)
              .replace("<prevMessage>", prevMessage)
              .replace("<channel>", commChannel)
              .replace("<user>", interaction.user));
            
            let field = this.client.embeds.service.commission_reply.fields;
            for(let i = 0; i < this.client.embeds.service.commission_reply.fields.length; i++) {
              commReplyEmbed.addFields([{ name: field[i].title, value: field[i].description.replace("<message>", modalValue)
                .replace("<prevMessage>", prevMessage)
                .replace("<channel>", commChannel)
                .replace("<user>", interaction.user), inline: this.client.embeds.service.commission_reply.inline }])
            }
            
            if(this.client.embeds.service.commission_reply.footer == true ) commReplyEmbed.setFooter({ text: interaction.user.username, iconURL: interaction.user.displayAvatarURL() }).setTimestamp();
            if(this.client.embeds.service.commission_reply.thumbnail == true) commReplyEmbed.setThumbnail(interaction.user.displayAvatarURL());

            const commRow = new Discord.ActionRowBuilder()
              .addComponents(
                new Discord.ButtonBuilder()
                  .setStyle(Discord.ButtonStyle.Secondary)
                  .setCustomId(`replyComm_${splitCustomId[1]}_${interaction.user.id}_${freelancerSender.id}`)
                  .setLabel(this.client.language.buttons.reply_message)
                  .setEmoji(config.emojis.reply_commission || {})
              );

            const commissionsChannel = this.client.channels.cache.get(commission.commChannelId);
            const fetchedCommission = await commissionsChannel.messages.fetch(commission.commMessageId);

            if(interaction.channel.isThread()) {
              commChannel.send({ embeds: [commReplyEmbed], components: [commRow] });
              md.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.commission.reply_sent.replace("<user>", `<@!${commission.user}>`).replace("<channel>", commChannel), this.client.embeds.success_color)], flags: Discord.MessageFlags.Ephemeral });
              prevQuestion.set(splitCustomId[1], modalValue);
              return;
            }

            fetchedCommission.thread.send({ content: `${userReply}`, embeds: [commReplyEmbed], components: [commRow] });
            md.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.service.commission.reply_sent.replace("<user>", `<@!${commission.user}>`).replace("<channel>", commChannel), this.client.embeds.success_color)], flags: Discord.MessageFlags.Ephemeral });

            prevQuestion.set(splitCustomId[1], modalValue);
          }).catch((err) => { 
            console.log(err)
          });
        } 
      }
    }

    if(interaction.isStringSelectMenu()) {
      if(interaction.channel.type != Discord.ChannelType.DM) {
        if(interaction.customId == "noSelection_panel") {
          const categoryValue = interaction.values[0];

          await interaction.deferUpdate();
          let blackListed = false;
          let member = interaction.guild.members.cache.get(user.id);
          if(config.roles.blacklist.some((bl) => member.roles.cache.has(bl))) blackListed = true;

          if(blackListed == true) 
            return interaction.followUp({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.ticket.bl_role, this.client.embeds.error_color)], flags: Discord.MessageFlags.Ephemeral })
          if(config.users.blacklist.includes(user.id))
            return interaction.followUp({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.ticket.bl_user, this.client.embeds.error_color)], flags: Discord.MessageFlags.Ephemeral })
          const noCategory = new Discord.EmbedBuilder()
            .setTitle(this.client.embeds.title)
            .setDescription(this.client.language.ticket.no_category)
            .setFooter({ text: this.client.embeds.footer, iconURL: user.displayAvatarURL({ dynamic: true }) })
            .setTimestamp()
            .setColor(this.client.embeds.error_color);
    
          if(config.channels.tickets_category == "") 
            return interaction.followUp({ embeds: [noCategory], flags: Discord.MessageFlags.Ephemeral });

          await interaction.message.edit({ embeds: [interaction.message.embeds[0]], components: [interaction.message.components[0]] })
          const findCategory = this.client.categories.find((c) => c.id.toLowerCase() == categoryValue.toLowerCase());
          if(findCategory.type == "SUBCATEGORY_PARENT") {
            const options = [];
            findCategory.subcategories.forEach(c => {
              options.push({
                label: c.name,
                value: c.id, 
                emoji: c.emoji || {},
                description: c.placeholder != "" ? c.placeholder : ""
              });
            });
            
            let sMenu = new Discord.StringSelectMenuBuilder()
              .setCustomId("instant_subCategory")
              .setPlaceholder(config.tickets.select_placeholder)
              .addOptions(options);
      
            let row = new Discord.ActionRowBuilder()
              .addComponents(sMenu);

            const selSubcategory = new Discord.EmbedBuilder()
              .setTitle(this.client.embeds.title)
              .setColor(this.client.embeds.general_color)

            selSubcategory.setDescription(this.client.embeds.select_subcategory.description
              .replace("<subcategories>", options.map((x) => `${x.emoji} - ${x.label}`).join("\n")));
            let field = this.client.embeds.select_subcategory.fields;
            for(let i = 0; i < this.client.embeds.select_subcategory.fields.length; i++) {
              selSubcategory.addFields([{ name: field[i].title, value: field[i].description
                .replace("<subcategories>", options.map((x) => `${x.emoji} - ${x.label}`).join("\n")) }])
            }
            
            if(this.client.embeds.ticket.footer.enabled == true) selSubcategory.setFooter({ text: this.client.embeds.footer, iconURL: this.client.user.displayAvatarURL({ size: 1024, dynamic: true }) }).setTimestamp();
            if(this.client.embeds.ticket.image.enabled == true) selSubcategory.setImage(this.client.embeds.ticket.image.url);
            if(this.client.embeds.ticket.thumbnail.enabled == true) selSubcategory.setThumbnail(this.client.embeds.ticket.thumbnail.url);

            await interaction.followUp({ embeds: [selSubcategory], components: [row], flags: Discord.MessageFlags.Ephemeral, fetchReply: true })
            const filter = (i) => i.customId == "instant_subCategory" && i.user.id == interaction.user.id;
            const collector = await interaction.channel.createMessageComponentCollector({ filter, time: config.tickets.no_select_delete * 1000, componentType: Discord.ComponentType.SelectMenu, max: 1, maxComponents: 1, maxUsers: 1 });

            collector.on("collect", async(i) => {
              collector.stop("collected");
              await i.deferUpdate();
              let selSub = i.values[0];
              this.client.emit("ticketCreate", interaction, member, "No Reason", {
                status: true,
                cat_id: categoryValue,
                subcategory: selSub
              });
            });

            collector.on("end", async(collected, reason) => { });            
          } else {
            this.client.emit("ticketCreate", interaction, member, "No Reason", {
              status: true,
              cat_id: categoryValue
            });
          }
        }

        // Suggestion Decision
        if(interaction.customId == "decision_menu" && this.client.config.general.sugg_decision == true) {
          let decisionData = await this.client.database.guildData().get(`${this.client.config.general.guild}.suggestionDecisions`);
          decisionData = decisionData.find((x) => x.decision == interaction.message.id);

          if(decisionData) {
            let suggChannel = this.client.utils.findChannel(interaction.guild, this.client.config.channels.suggestions);
            let fetchSuggestion = await suggChannel.messages.fetch({ message: decisionData.id });
            if(!fetchSuggestion) return;
            let decidedChannel = this.client.utils.findChannel(interaction.guild, this.client.config.channels.sugg_logs);
            let value = interaction.values[0];
    
            if(value == "decision_accept") {
              let acceptEmbed = new Discord.EmbedBuilder()
                .setTitle(this.client.language.titles.sugg_accepted)
                .setColor(this.client.embeds.success_color);
              
              if(fetchSuggestion.embeds[0].data.description) acceptEmbed.setDescription(fetchSuggestion.embeds[0].data.description);
              if(fetchSuggestion.embeds[0].data.footer) acceptEmbed.setFooter(fetchSuggestion.embeds[0].data.footer).setTimestamp();
              if(fetchSuggestion.embeds[0].data.thumbnail) acceptEmbed.setThumbnail(fetchSuggestion.embeds[0].data.thumbnail.url);
              if(fetchSuggestion.embeds[0].data.fields) acceptEmbed.addFields(fetchSuggestion.embeds[0].data.fields);
    
              let reasonInput = new Discord.ActionRowBuilder()
                .addComponents(
                  new Discord.TextInputBuilder()
                    .setCustomId("decision_reason")
                    .setLabel(this.client.language.modals.labels.decision)
                    .setPlaceholder(this.client.language.modals.placeholders.decision)
                    .setRequired(false)
                    .setStyle(Discord.TextInputStyle.Paragraph)
                );
              
              let reasonModal = new Discord.ModalBuilder()
                .setTitle(this.client.language.titles.sugg_accepted)
                .setCustomId("decision_modal")
                .addComponents(reasonInput);
              
              interaction.showModal(reasonModal);
  
              await interaction.message.delete();
              await fetchSuggestion.delete();
              let deicdedMsg = await decidedChannel.send({ embeds: [acceptEmbed] });
              interaction.followUp({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.general.suggestions.accepted, this.client.embeds.success_color)], flags: Discord.MessageFlags.Ephemeral });
  
              const filter = (i) => i.customId == 'decision_modal' && i.user.id == interaction.user.id;
              interaction.awaitModalSubmit({ filter, time: 60_000 })
                .then(async(md) => {
                await md.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.general.suggestions.decision_reason, this.client.embeds.success_color)], flags: Discord.MessageFlags.Ephemeral });
                let reasonValue = md.fields.getTextInputValue("decision_reason");
                if(reasonValue.length > 1) {
                  acceptEmbed.addFields([{ name: this.client.language.titles.accept_reason, value: reasonValue }]);
                  await deicdedMsg.edit({ embeds: [acceptEmbed] });
                }
              }).catch((err) => { console.log(err) });
            } else if(value == "decision_deny") {
              let denyEmbed = new Discord.EmbedBuilder()
                .setTitle(this.client.language.titles.sugg_denied)
                .setColor(this.client.embeds.error_color);
    
              if(fetchSuggestion.embeds[0].data.description) denyEmbed.setDescription(fetchSuggestion.embeds[0].data.description);
              if(fetchSuggestion.embeds[0].data.footer) denyEmbed.setFooter(fetchSuggestion.embeds[0].data.footer).setTimestamp();
              if(fetchSuggestion.embeds[0].data.thumbnail) denyEmbed.setThumbnail(fetchSuggestion.embeds[0].data.thumbnail.url);
              if(fetchSuggestion.embeds[0].data.fields) denyEmbed.addFields(fetchSuggestion.embeds[0].data.fields);
    
              let reasonInput = new Discord.ActionRowBuilder()
                .addComponents(
                  new Discord.TextInputBuilder()
                    .setCustomId("decision_reason")
                    .setLabel(this.client.language.modals.labels.decision)
                    .setPlaceholder(this.client.language.modals.placeholders.decision)
                    .setRequired(false)
                    .setStyle(Discord.TextInputStyle.Paragraph)
                );
              
              let reasonModal = new Discord.ModalBuilder()
                .setTitle(this.client.language.titles.sugg_denied)
                .setCustomId("decision_modal")
                .addComponents(reasonInput);
                
              interaction.showModal(reasonModal);
  
              await interaction.message.delete();
              await fetchSuggestion.delete();
              let deicdedMsg = await decidedChannel.send({ embeds: [denyEmbed] });
              interaction.followUp({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.general.suggestions.denied, this.client.embeds.success_color)], flags: Discord.MessageFlags.Ephemeral });
  
              const filter = (i) => i.customId == 'decision_modal' && i.user.id == interaction.user.id;
              interaction.awaitModalSubmit({ filter, time: 60_000 })
                .then(async(md) => {
                await md.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.general.suggestions.decision_reason, this.client.embeds.success_color)], flags: Discord.MessageFlags.Ephemeral });
                let reasonValue = md.fields.getTextInputValue("decision_reason");
                if(reasonValue.length > 1) {
                  denyEmbed.addFields([{ name: this.client.language.titles.deny_reason, value: reasonValue }]);
                  await deicdedMsg.edit({ embeds: [denyEmbed] });
                }
              }).catch((err) => { console.log(err) });
            } else if(value == "decision_delete") {
              await interaction.message.delete();
              await fetchSuggestion.delete();
              interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.general.suggestions.deleted, this.client.embeds.success_color)], flags: Discord.MessageFlags.Ephemeral });
              await this.client.database.suggestionsData().delete(`${decisionData}`);
            }
          }
        }
      }
    } 

    if(interaction.type == Discord.InteractionType.ModalSubmit) {
      if(interaction.customId == "askQuestions_modal") {
        let channelData = await this.client.database.ticketsData().get(`${interaction.channel.id}`);
        let currPage = channelData.questionPage || 1;
        channelData.listOfAnswers = channelData.listOfAnswers || [];
        const listOfQuestions = channelData.listOfQuestions;

        if (parseInt(currPage + 1) > listOfQuestions.modalArr.length || listOfQuestions.modalArr.length == 1) {
          await interaction.deferUpdate().catch((err) => {});
          
          if(listOfQuestions.modalArr.length <= 5) {
            for(let i = 0; i < interaction.components.length; i++) {
              let questionIndex = interaction.components[i].components[0].customId.split("_")[1];
              channelData.listOfAnswers.push({
                questionName: listOfQuestions.list[questionIndex].name,
                question: listOfQuestions.list[questionIndex].question,
                answer: interaction.components[i].components[0].value || "N/A"
              });
            }

            await this.client.database.ticketsData().set(`${interaction.channel.id}.listOfAnswers`, channelData.listOfAnswers);
          }
          
          await this.client.database.ticketsData().set(`${interaction.channel.id}.questionsAnswered`, true);
    
          let editActionRow = Discord.ActionRowBuilder.from(interaction.message.components[0]);
          editActionRow.components.forEach((c) => {
            if(c.data.custom_id != "closeTicket" && c.data.custom_id != "claimTicket") c.setStyle(Discord.ButtonStyle.Secondary)
              .setLabel(this.client.language.buttons.answered_all)
              .setDisabled(true);
          });
    
          await interaction.followUp({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.ticket.answered_all, this.client.embeds.success_color)], flags: Discord.MessageFlags.Ephemeral });
          interaction.message.edit({ embeds: [interaction.message.embeds[0]], components: [editActionRow] });
          let answerData = channelData.listOfAnswers || [];
          
          let submitEmbed = new Discord.EmbedBuilder()
            .setTitle(this.client.embeds.service.new_commission.title)
            .setColor(this.client.embeds.service.new_commission.color);

          let answersEmbeds = [];
          let charLimit = 0;
          for (let i = 0; i < answerData.length; i++) {
            answerData[i].answer = answerData[i].answer == "" 
              || !answerData[i].answer || !answerData[i].answer.trim() ? "N/A" : answerData[i].answer;

            if(submitEmbed.fields?.length >= 25 || charLimit >= 5000) {
              answersEmbeds.push(submitEmbed);
              submitEmbed = new Discord.EmbedBuilder()
                .setTitle(this.client.embeds.service.new_commission.title)
                .setColor(this.client.embeds.service.new_commission.color);
              charLimit = 0;
            }
    
            if(answerData[i].answer.length <= 1024) {
              submitEmbed.addFields([{ name: answerData[i].questionName, value: answerData[i].answer }]);
              charLimit += answerData[i].answer.length;
            } else {
              let maxFieldLength = 1024;
              const regexPattern = new RegExp(`.{1,${maxFieldLength}}|.{1,${maxFieldLength}}$`, 'g');
              const chunks = answerData[i].answer.match(regexPattern);
    
              for(let j = 0; j < chunks.length; j++) {
                if(submitEmbed.fields?.length >= 25 || charLimit >= 5000) {
                  answersEmbeds.push(submitEmbed);
        
                  submitEmbed = new Discord.EmbedBuilder()
                    .setTitle(this.client.embeds.service.new_commission.title)
                    .setColor(this.client.embeds.service.new_commission.color);
                  charLimit = 0;
                }
    
                submitEmbed.addFields([{ name: answerData[i].questionName + ` (${j + 1})`, value: chunks[j] }]);
                charLimit += chunks[j].length;
              }
            }

           /*  submitEmbed.addFields([{ name: answerData[i].questionName, value: answerData[i].answer == "" 
              || !answerData[i].answer || !answerData[i].answer.trim() ? "N/A" : answerData[i].answer }]); */
          }

          answersEmbeds.push(submitEmbed);
    
          interaction.channel.permissionOverwrites.edit(interaction.user, {
            SendMessages: true,
            ViewChannel: true
          });

          await interaction.channel.threads.create({
            name: this.client.language.ticket.answers_thread_name,
            autoArchiveDuration: Discord.ThreadAutoArchiveDuration.OneWeek
          }).then(async(tm) => {
            for(let i = 0; i < answerData.length; i++) {
              const answerToQuestion = answerData[i].answer;
              if(answerToQuestion.length >= 1950) {
                let maxQuestionLength = 1950;
                const regexPattern = new RegExp(`.{1,${maxQuestionLength}}|.{1,${maxQuestionLength}}$`, 'g');
                const chunks = answerData[i].answer.match(regexPattern);
                
                for(let j = 0; j < chunks.length; j++) {
                  await tm.send({ content: this.client.config.tickets.question_answer_format
                    .replace("<name>", answerData[i].questionName + ` (${j + 1})`)
                    .replace("<question>", answerData[i].question + ` (${j + 1})`)
                    .replace("<answer>", chunks[j]) });
                }
              } else {
                await tm.send({ content: this.client.config.tickets.question_answer_format
                  .replace("<name>", answerData[i].questionName)
                  .replace("<question>", answerData[i].question)
                  .replace("<answer>", answerData[i].answer == "" 
                    || !answerData[i].answer || !answerData[i].answer.trim() ? "N/A" : answerData[i].answer) });
              }
            }
          });
          
          if(config.general.send_commissions == true && config.channels.commissions != "" && listOfQuestions.ticketCategory?.type == "COMMISSION") {
            submitEmbed.setTitle(this.client.embeds.service.new_commission.title)
              .setColor(this.client.embeds.service.new_commission.color);

            if(this.client.embeds.service.new_commission.description) submitEmbed.setDescription(this.client.embeds.service.new_commission.description.replace("<user>", interaction.user));
            if(this.client.embeds.service.new_commission.thumbnail == true) submitEmbed.setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }));
            if(this.client.embeds.service.new_commission.footer == true) submitEmbed.setFooter({ text: interaction.user.username, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) }).setTimestamp();

            let commChannel = this.client.utils.findChannel(interaction.guild, config.channels.commissions);
    
            const commRow = new Discord.ActionRowBuilder()
              .addComponents(
                new Discord.ButtonBuilder()
                  .setStyle(Discord.ButtonStyle.Success)
                  .setCustomId(`commission_${interaction.channel.id}`)
                  .setLabel(this.client.language.buttons.send_quote)
                  .setEmoji(config.emojis.send_quote || {})
              )
    
            if(config.general.buttons.message_client == true) commRow.addComponents(
              new Discord.ButtonBuilder()
                .setStyle(Discord.ButtonStyle.Secondary)
                .setCustomId(`commissionMessage_${interaction.channel.id}`)
                .setLabel(this.client.language.buttons.message_client)
                .setEmoji(config.emojis.msg_commission || {})
            )
    
            if(listOfQuestions.ticketCategory && listOfQuestions.ticketCategory?.commission) {
              let categoryCommCh = this.client.utils.findChannel(interaction.guild, listOfQuestions.ticketCategory.commission.channel);
              let categoryCommRoles = listOfQuestions.ticketCategory.commission.roles.map((x) => {
                let findRole = this.client.utils.findRole(interaction.channel.guild, x);
                if(findRole) return findRole;
              });
    
              if(categoryCommCh) {
                await categoryCommCh.send({ content: categoryCommRoles.length > 0 ? `${categoryCommRoles.join(" ")}` : '', embeds: answersEmbeds, components: [commRow] }).then(async(m) => {
                  const commission = await this.client.database.ticketsData().get(`${interaction.channel.id}.commission`);
                  commission.commMessageId = m.id;
                  commission.commChannelId = m.channel.id;
                  
                  await m.startThread({ name: this.client.language.service.commission.commission_thread.replace("<id>", commission.id) }).then((thread) => {
                    commission.commThreadId = thread.id;
                  });

                  await this.client.database.ticketsData().set(`${interaction.channel.id}.commission`, commission);
                });
              } else {
                await commChannel.send({ content: categoryCommRoles.length > 0 ? `${categoryCommRoles.join(" ")}` : '', embeds: answersEmbeds, components: [commRow] }).then(async(m) => {
                  const commission = await this.client.database.ticketsData().get(`${interaction.channel.id}.commission`);
                  commission.commMessageId = m.id;
                  commission.commChannelId = m.channel.id;
                  
                  await m.startThread({ name: this.client.language.service.commission.commission_thread.replace("<id>", commission.id) }).then((thread) => {
                    commission.commThreadId = thread.id;
                  });
                  await this.client.database.ticketsData().set(`${interaction.channel.id}.commission`, commission);
                });
              }
            } else {
              await commChannel.send({ embeds: answersEmbeds, components: [commRow] }).then(async(m) => {
                const commission = await this.client.database.ticketsData().get(`${interaction.channel.id}.commission`);
                commission.commMessageId = m.id;
                commission.commChannelId = m.channel.id;
                
                await m.startThread({ name: this.client.language.service.commission.commission_thread.replace("<id>", commission.id) }).then((thread) => {
                  commission.commThreadId = thread.id;
                });
                await this.client.database.ticketsData().set(`${interaction.channel.id}.commission`, commission);
              });
            }
          }
        } else {
          let channelData = await this.client.database.ticketsData().get(`${interaction.channel.id}`);
          let questionPage = channelData.questionPage || 1;
          questionPage = questionPage += 1
          await this.client.database.ticketsData().set(`${interaction.channel.id}.questionPage`, questionPage);
          channelData.listOfAnswers = channelData.listOfAnswers || [];
    
          for(let i = 0; i < interaction.components.length; i++) {
            let questionIndex = interaction.components[i].components[0].customId.split("_")[1];
            channelData.listOfAnswers.push({
              questionName: listOfQuestions.list[questionIndex].name,
              question: listOfQuestions.list[questionIndex].question,
              answer: interaction.components[i].components[0].value || "N/A"
            });
          }

          await this.client.database.ticketsData().set(`${interaction.channel.id}.listOfAnswers`, channelData.listOfAnswers);
    
          questModal = new Discord.ModalBuilder()
            .setTitle(this.client.language.titles.questions.replace("<page>", parseInt(questionPage)).replace("<max>", listOfQuestions.modalArr.length))
            .setComponents(listOfQuestions.modalArr[parseInt(questionPage - 1)])
            .setCustomId("askQuestions_modal");
    
          let editActionRow = Discord.ActionRowBuilder.from(interaction.message.components[0]);
          editActionRow.components.forEach((c) => {
            if(c.data.custom_id != "closeTicket" && c.data.custom_id != "claimTicket") c.setLabel(this.client.language.buttons.answer_questions.replace("<page>", questionPage));
          });
          
          await interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.embeds.title, this.client.language.ticket.answered_set, this.client.embeds.general_color)], flags: Discord.MessageFlags.Ephemeral });
          interaction.message.edit({ embeds: [interaction.message.embeds[0]], components: [editActionRow] })
        }
      }
    }
	}
};
