const Event = require("../../structures/Events");
const { ButtonBuilder, ActionRowBuilder, EmbedBuilder, ButtonStyle, InteractionType, 
  ComponentType, OverwriteType } = require("discord.js");
const { textTranscript, htmlTranscript } = require("../../utils/createTranscript.js"); 
const askReview = require("../../utils/askReview.js");

module.exports = class TicketClose extends Event {
  constructor(...args) {
    super(...args);
  }

  async run(message, member, reason = "No Reason") {
    let config = this.client.config;
    let language = this.client.language;
    let confirmBttn = new ButtonBuilder()
      .setStyle(ButtonStyle.Primary)
      .setLabel(this.client.language.buttons.confirm_close)
      .setEmoji(config.emojis.close || {})
      .setCustomId('confirmClose');
    let cancelBttn = new ButtonBuilder()
      .setStyle(ButtonStyle.Danger)
      .setLabel(this.client.language.buttons.cancel_close)
      .setEmoji(config.emojis.cancel_close || {})
      .setCustomId('cancelClose');
  
    let confirmRow = new ActionRowBuilder()
      .addComponents(confirmBttn)
      .addComponents(cancelBttn);
    let confirm = this.client.embedBuilder(this.client, member.user, this.client.embeds.title, language.ticket.close_confirmation, this.client.embeds.success_color);
    if (this.client.embeds.close.image.enabled == true) confirm.setImage(this.client.embeds.close.image.url);
    if (this.client.embeds.close.thumbnail.enabled == true) confirm.setThumbnail(this.client.embeds.close.thumbnail.url);
  
    let m;
    if(message.type == InteractionType.ApplicationCommand) {
      m = await message.reply({ embeds: [confirm], components: [confirmRow], fetchReply: true });
    } else if(message.type == InteractionType.MessageComponent){
      m = await message.reply({ embeds: [confirm], components: [confirmRow], fetchReply: true });
    } else {
      m = await message.channel.send({ embeds: [confirm], components: [confirmRow] });
    }

    const filter = i => i.user.id == member.id;

    let collector = m.createMessageComponentCollector({filter, componentType: ComponentType.Button, time: this.client.config.tickets.confirm_close_time * 1000 });

    collector.on('collect', async (b) => {
      await b.deferUpdate();
      if (b.customId == `confirmClose`) {
        await askReview(this.client, message.channel, message.guild);
        collector.stop("claimed");
        message.channel.send({ embeds: [this.client.embedBuilder(this.client, member.user, this.client.embeds.title, language.ticket.ticket_deleted, this.client.embeds.general_color)] });

        if(this.client.config.server.dashboard.home.chart.save_close == true)
          await this.client.database.guildData().push(`${this.client.config.general.guild}.todayStats`, { action: "CLOSE" });

				let ticketData = await this.client.database.ticketsData().get(`${message.channel.id}.ticketData`);
        const ticketOwner = this.client.users.cache.get(ticketData?.owner);
        let memberTickets = await this.client.database.usersData().get(`${ticketData?.owner}.tickets`) || [];
				memberTickets = memberTickets.filter((x) => x.channel != message.channel.id);
        
        await this.client.utils.serverLogs(this.client, {
          date: new Date().toLocaleString("en-GB"),
          author_id: member.user.id,
          author: member.user.username,
          user_id: null,
          user: null,
          channel_id: `${message.channel.id}`,
          channel_name: `${message.channel.name}`,
          ticketId: ticketData.id,
          message: `ticket_close`
        });

        if(this.client.config.tickets.dm_author == true && ticketOwner && member.id != ticketOwner?.id) {
          let dmUserEmbed = new EmbedBuilder()
            .setColor(this.client.embeds.ticket_close_dm.color);
          
          if(this.client.embeds.ticket_close_dm.title) dmUserEmbed.setTitle(this.client.embeds.ticket_close_dm.title);
          let field = this.client.embeds.ticket_close_dm.fields;
          for(let i = 0; i < this.client.embeds.ticket_close_dm.fields.length; i++) {
            dmUserEmbed.addFields([{ name: field[i].title, value: field[i].description.replace("<author>", ticketOwner.username)
              .replace("<authorId>", `${ticketOwner.id}`)
              .replace("<reason>", `${reason || "N/A"}`)
              .replace("<ticketId>", `${ticketData.id}`)
              .replace("<closedBy>", member.user.username)
              .replace("<closedById>", member.id)
              .replace("<channel>", `${message.channel.name}`), inline: this.client.embeds.ticket_close_dm.inline }]);
          }
          
          if(this.client.embeds.ticket_close_dm.footer == true) dmUserEmbed.setFooter({ text: member.user.username, iconURL: member.user.displayAvatarURL({ size: 1024, dynamic: true }) }).setTimestamp();
          if(this.client.embeds.ticket_close_dm.thumbnail == true) dmUserEmbed.setThumbnail(member.user.displayAvatarURL({ dynamic: true }));
          
          if(this.client.embeds.ticket_close_dm.description) dmUserEmbed.setDescription(this.client.embeds.ticket_close_dm.description.replace("<author>", ticketOwner.username)
            .replace("<authorId>", `${ticketOwner.id}`)
            .replace("<reason>", `${reason || "N/A"}`)
            .replace("<ticketId>", `${ticketData.id}`)
            .replace("<closedBy>", member.user.username)
            .replace("<closedById>", member.id)
            .replace("<channel>", `${message.channel.name}`));
    
          ticketOwner.send({ embeds: [dmUserEmbed] }).catch((err) => {
            console.error("User's DM Closed");
          });
        }

        await this.client.database.usersData().set(`${ticketData?.owner}.tickets`, memberTickets);
        await this.client.database.usersData().delete(`${ticketData?.owner}.choosingCategory`);
  
        if (config.tickets.transcripts == false) {
          if(this.client.config.tickets.move_closed == true) {
            const moveCategory = this.client.utils.findChannel(message.guild, this.client.config.channels.move_closed);

            message.channel.edit({ parent: moveCategory }).then(async(ch) => {
              for(const perm of ch.permissionOverwrites.cache) {
                if(perm[1].type == OverwriteType.Member) {
                  if(perm[0] == ticketData?.owner) 
                    ch.permissionOverwrites.delete(perm);
                } 
              }

              let actionsButtons = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                .setCustomId("delete_ticket")
                .setLabel(this.client.language.buttons.delete_ticket)
                .setStyle(ButtonStyle.Danger)
                .setEmoji(this.client.config.emojis.delete_ticket)
            );

              await message.channel.send({ embeds: [this.client.embedBuilder(this.client, member.user, this.client.embeds.title, language.ticket.ticket_move_closed.replace("<user>", member.user.username), this.client.embeds.general_color)], components: [actionsButtons] });
            })
          } else {
            setTimeout(async() => {
              message.channel.delete();
            }, this.client.config.tickets.delete_after * 1000);
          }
          return;
        }
        if (config.channels.transcripts == "")
          return message.channel.send({ embeds: [this.client.embedBuilder(this.client, member.user, this.client.embeds.title, language.ticket.no_transcript, this.client.embeds.error_color)] });
        
        let canRename = await this.client.utils.canEditName(message.guild, message.channel);
        if(this.client.config.tickets.rename_close == true && canRename == true && ticketOwner &&
          !message.channel.name.includes(this.client.config.channels.priority_name.replace("<priority>", ""))) {
          message.channel.setName(this.client.utils.ticketPlaceholders(config.channels.closed_name, ticketOwner, ticketData?.id)).catch((e) => this.client.utils.sendWarn("Bot cannot rename this channel at the moment."));
        }

        if(config.tickets.transcript_type == "HTML") {
          await htmlTranscript(this.client, message.channel, message.member, reason);
        } else {
          await textTranscript(this.client, message.channel, message.member, reason);
        }
      } else if (b.customId == `cancelClose`) {
        collector.stop("claimed");
        confirmRow.components[0].setStyle(ButtonStyle.Secondary).setDisabled(true);
        confirmRow.components[1].setStyle(ButtonStyle.Secondary).setDisabled(true);
        m.edit({ embeds: [confirm], components: [confirmRow] });
        message.channel.send({ embeds: [this.client.embedBuilder(this.client, member.user, this.client.embeds.title, language.ticket.cancel_delete, this.client.embeds.success_color)] });
      }
    });
    collector.on("end", (collected, reason) => {
      if(!message.channel) return;
      confirmRow.components[0].setStyle(ButtonStyle.Secondary).setDisabled(true);
      confirmRow.components[1].setStyle(ButtonStyle.Secondary).setDisabled(true);

      m.edit({ embeds: [confirm], components: [confirmRow] });
      if(reason.toLowerCase() == "claimed") return;
      
      message.channel.send({ embeds: [this.client.embedBuilder(this.client, member.user, this.client.embeds.title, language.ticket.time_expired, this.client.embeds.error_color)] });
    });
  }
};
