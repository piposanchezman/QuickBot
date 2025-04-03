const Discord = require("discord.js");
const fs = require("fs");
const { generateTranscript } = require("./utils.js");

const htmlTranscript = async (client, channel, member, reason) => {
  let config = client.config;
  let ticketData = await client.database.ticketsData().get(`${channel.id}.ticketData`);
  let messageCollection = new Discord.Collection();
  let channelMessages = await channel.messages.fetch({ limit: 100 });

  let randomIdCase = Math.floor(Math.random() * 1000);

  messageCollection = messageCollection.concat(channelMessages);

  while(channelMessages.size === 100) {
    let lastMessageId = channelMessages.lastKey();
    channelMessages = await channel.messages.fetch({ limit: 100, before: lastMessageId });
    if(channelMessages) messageCollection = messageCollection.concat(channelMessages);
  }
  
  let msgs = [...messageCollection.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp)
  let data = await fs.readFileSync('./data/template.html', {
    encoding: 'utf-8'
  });
  if(data) {
    await generateTranscript(client, channel, msgs, ticketData?.id || randomIdCase);
    let path = `./transcripts/ticket-${ticketData?.id || randomIdCase}.html`;
    
    let transcriptCode;
    if (config.server.selfhost.enabled == true) {
      transcriptCode = (Math.random() * 466567).toString(36).slice(-7).replace(".", "");
      await client.database.transcriptsData().set(`${ticketData?.id || randomIdCase}`, {
        code: transcriptCode,
        owner: ticketData?.owner,
        date: new Date()
      });
    }

    const category = ticketData?.category;
    const findCategory = category ? client.categories.map((c) => {
      const subSearch = c.subcategories?.find((sc) => sc.id.toLowerCase() == category.toLowerCase() || sc.id.toLowerCase().includes(category.toLowerCase()));
      if(c.id.toLowerCase() == category.toLowerCase() || c.id.toLowerCase().includes(category.toLowerCase()))
        return c;
      else if(subSearch)
        return c;
    }).filter(Boolean)?.[0] : undefined;
    const ticketCategory = findCategory?.name || "N/A";

    let logEmbed = new Discord.EmbedBuilder()
      .setColor(client.embeds.transcript_log.color);

    if (client.embeds.transcript_log.title) logEmbed.setTitle(client.embeds.transcript_log.title);
    let field = client.embeds.transcript_log.fields;
    for (let i = 0; i < client.embeds.transcript_log.fields.length; i++) {
      logEmbed.addFields([{ name: field[i].title, value: field[i].description.replace("<closedBy>", member.user.username)
        .replace("<closedById>", member.id)
        .replace("<ticketId>", `${ticketData?.id || randomIdCase}`)
        .replace("<author>", client.users.cache.get(ticketData?.owner)?.username)
        .replace("<authorId>", ticketData?.owner)
        .replace("<channelId>", channel.id)
        .replace("<reason>", reason)
        .replace("<category>", ticketCategory)
        .replace("<channelName>", channel.name)
        .replace("<transcriptCode>", transcriptCode || "N/A")
        .replace("<openedAt>", `<t:${Math.round(ticketData?.openedTimestamp/1000)}:F>`)
        .replace("<closedAt>", `<t:${Math.round(new Date().getTime()/1000)}:F>`), inline: client.embeds.transcript_log.inline }])
    }

    if (client.embeds.transcript_log.footer == true) logEmbed.setFooter({ text: member.user.username, iconURL: member.user.displayAvatarURL() }).setTimestamp();
    if (client.embeds.transcript_log.thumbnail == true) logEmbed.setThumbnail(member.user.displayAvatarURL());

    if (client.embeds.transcript_log.description) logEmbed.setDescription(client.embeds.transcript_log.description.replace("<closedBy>", member.user.username)
      .replace("<closedById>", member.id)
      .replace("<ticketId>", `${ticketData?.id || randomIdCase}`)
      .replace("<author>", client.users.cache.get(ticketData?.owner)?.username)
      .replace("<authorId>", ticketData?.owner)
      .replace("<reason>", reason)
      .replace("<category>", ticketCategory)
      .replace("<channelId>", channel.id)
      .replace("<channelName>", channel.name)
      .replace("<transcriptCode>", transcriptCode || "N/A")
      .replace("<openedAt>", `<t:${Math.round(ticketData?.openedTimestamp/1000)}:F>`)
      .replace("<closedAt>", `<t:${Math.round(new Date().getTime()/1000)}:F>`));
    
    let serverUrl = client.config.server.url || "http://localhost";
    let bttnRow = new Discord.ActionRowBuilder();
    
    let dwnButton = new Discord.ButtonBuilder()
      .setURL(serverUrl + `/transcripts/${ticketData?.id || randomIdCase}/download`)
      .setLabel(client.language.buttons.transcripts.download)
      .setStyle(Discord.ButtonStyle.Link)
      .setEmoji(client.config.emojis.transcripts.download || {});
    let viewButton = new Discord.ButtonBuilder()
      .setURL(serverUrl + `/transcripts/${ticketData?.id || randomIdCase}`)
      .setLabel(client.language.buttons.transcripts.view)
      .setStyle(Discord.ButtonStyle.Link)
      .setEmoji(client.config.emojis.transcripts.view || {});
    
    if(client.config.server.selfhost.download == true && client.config.server.enabled == true) bttnRow.addComponents(dwnButton);
    if(client.config.server.selfhost.view == true && client.config.server.enabled == true) bttnRow.addComponents(viewButton);

    let sendObject = {
      embeds: [logEmbed],
      files: client.config.server.selfhost.download == false ? [path] : [],
      components: bttnRow.components.length > 0 ? [bttnRow] : []
    }

    let aChannel = client.utils.findChannel(member.guild, config.channels.transcripts);
    if(aChannel) {
      await aChannel.send(sendObject);
    }

    if(client.config.tickets.move_closed == true) {
      const moveCategory = client.utils.findChannel(channel.guild, client.config.channels.move_closed);

      channel.edit({ parent: moveCategory }).then(async(ch) => {
        for(const perm of ch.permissionOverwrites.cache) {
          if(perm[1].type == Discord.OverwriteType.Member) {
            if(perm[0] == ticketData?.owner) 
              ch.permissionOverwrites.delete(perm[0]);
          } 
        }

        let actionsButtons = new Discord.ActionRowBuilder().addComponents(
          new Discord.ButtonBuilder()
            .setCustomId("delete_ticket")
            .setLabel(client.language.buttons.delete_ticket)
            .setStyle(Discord.ButtonStyle.Danger)
            .setEmoji(client.config.emojis.delete_ticket)
        );

        await channel.send({ embeds: [client.embedBuilder(client, member.user, client.embeds.title, client.language.ticket.ticket_move_closed.replace("<user>", member.user.username), client.embeds.general_color)], components: [actionsButtons] });
      })
    } else {
      setTimeout(async() => {
        if(channel) await channel.delete();
      }, client.config.tickets.delete_after * 1000);
    }
    
    if(config.tickets.dm_transcript == true) {
      let dmEmbed = new Discord.EmbedBuilder()
        .setColor(client.embeds.dm_transcript.color);

      if(client.embeds.dm_transcript.title) dmEmbed.setTitle(client.embeds.dm_transcript.title);
      let field = client.embeds.dm_transcript.fields;
      for(let i = 0; i < client.embeds.dm_transcript.fields.length; i++) {
        dmEmbed.addFields([{ name: field[i].title, value: field[i].description.replace("<closedBy>", member.user.username)
          .replace("<closedById>", member.id)
          .replace("<ticketId>", `${ticketData?.id || randomIdCase}`)
          .replace("<author>", client.users.cache.get(ticketData?.owner)?.username)
          .replace("<authorId>", ticketData?.owner)
          .replace("<reason>", reason)
          .replace("<category>", ticketCategory)
          .replace("<channelId>", channel.id)
          .replace("<channelName>", channel.name)
          .replace("<transcriptCode>", transcriptCode || "N/A")
          .replace("<openedAt>", `<t:${Math.round(ticketData?.openedTimestamp/1000)}:F>`)
          .replace("<closedAt>", `<t:${Math.round(new Date().getTime()/1000)}:F>`), inline: client.embeds.dm_transcript.inline }])
      }
      
      if(client.embeds.dm_transcript.footer == true) dmEmbed.setFooter({ text: member.user.username, iconURL: member.user.displayAvatarURL() }).setTimestamp();
      if(client.embeds.dm_transcript.thumbnail == true) dmEmbed.setThumbnail(member.user.displayAvatarURL());

      if(client.embeds.dm_transcript.description) dmEmbed.setDescription(client.embeds.dm_transcript.description.replace("<closedBy>", member.user.username)
        .replace("<closedById>", member.id)
        .replace("<ticketId>", `${ticketData?.id || randomIdCase}`)
        .replace("<author>", client.users.cache.get(ticketData?.owner)?.username)
        .replace("<authorId>", ticketData?.owner)
        .replace("<reason>", reason)
        .replace("<category>", ticketCategory)
        .replace("<channelId>", channel.id)
        .replace("<channelName>", channel.name)
        .replace("<transcriptCode>", transcriptCode || "N/A")
        .replace("<openedAt>", `<t:${Math.round(ticketData?.openedTimestamp/1000)}:F>`)
        .replace("<closedAt>", `<t:${Math.round(new Date().getTime()/1000)}:F>`));

      let supportDM = await client.database.ticketsData().get(`${channel.id}.ticketClaimed`);
      let authorDM = client.users.cache.get(ticketData?.owner);
      supportDM = client.users.cache.get(supportDM);

      sendObject.embeds = [dmEmbed];
      if(authorDM != undefined) {
        authorDM.send(sendObject).catch((err) => {
          console.error("Author's DM Closed");
        });
      }
      if(supportDM != undefined && supportDM != authorDM) {
        supportDM.send(sendObject).catch((err) => {
          console.error("Support's DM Closed");
        });
      }
    };
  }
}

const textTranscript = async (client, channel, member, reason) => {
  let config = client.config;
  let ticketData = await client.database.ticketsData().get(`${channel.id}.ticketData`);

  let randomIdCase = Math.floor(Math.random() * 1000);

  let write = fs.createWriteStream(`transcripts/ticket-${ticketData?.id || randomIdCase}.txt`);
  channel.messages.fetch({ limit: 100 }).then(async(messages) => {
    let messages2 = messages;
    let me = messages2.sort((b, a) => b.createdTimestamp - a.createdTimestamp);

    me.forEach((msg) => {
      const time = msg.createdAt.toLocaleString("en-GB");
      write.write(`[${time}] ${msg.author.username}: ${msg.content}\n`);
    });
    write.end();
    
    let transcriptCode;
    if (config.server.selfhost.enabled == true) {
      transcriptCode = (Math.random() * 466567).toString(36).slice(-7).replace(".", "");
      await client.database.transcriptsData().set(`${ticketData?.id || randomIdCase}`, {
        code: transcriptCode,
        author: ticketData?.owner,
        date: new Date()
      });
    }
    
    let logEmbed = new Discord.EmbedBuilder()
      .setColor(client.embeds.transcript_log.color);

    if (client.embeds.transcript_log.title) logEmbed.setTitle(client.embeds.transcript_log.title);
    let field = client.embeds.transcript_log.fields;
    for (let i = 0; i < client.embeds.transcript_log.fields.length; i++) {
      logEmbed.addFields([{ name: field[i].title, value: field[i].description.replace("<closedBy>", member.user.username)
        .replace("<closedById>", member.id)
        .replace("<ticketId>", `${ticketData?.id || randomIdCase}`)
        .replace("<author>", client.users.cache.get(ticketData?.owner)?.username)
        .replace("<authorId>", ticketData?.owner)
        .replace("<reason>", reason)
        .replace("<channelId>", channel.id)
        .replace("<channelName>", channel.name)
        .replace("<transcriptCode>", transcriptCode || "N/A")
        .replace("<openedAt>", `<t:${Math.round(ticketData?.openedTimestamp/1000)}:F>`)
        .replace("<closedAt>", `<t:${Math.round(new Date().getTime()/1000)}:F>`), inline: client.embeds.transcript_log.inline }])
    }

    if (client.embeds.transcript_log.footer == true) logEmbed.setFooter({ text: member.user.username, iconURL: member.user.displayAvatarURL() }).setTimestamp();
    if (client.embeds.transcript_log.thumbnail == true) logEmbed.setThumbnail(member.user.displayAvatarURL());

    if (client.embeds.transcript_log.description) logEmbed.setDescription(client.embeds.transcript_log.description.replace("<closedBy>", member.user.username)
      .replace("<closedById>", member.id)
      .replace("<ticketId>", `${ticketData?.id || randomIdCase}`)
      .replace("<author>", client.users.cache.get(ticketData?.owner)?.username)
      .replace("<authorId>", ticketData?.owner)
      .replace("<reason>", reason)
      .replace("<channelId>", channel.id)
      .replace("<channelName>", channel.name)
      .replace("<transcriptCode>", transcriptCode || "N/A")
      .replace("<openedAt>", `<t:${Math.round(ticketData?.openedTimestamp/1000)}:F>`)
      .replace("<closedAt>", `<t:${Math.round(new Date().getTime()/1000)}:F>`));
    
    let aChannel = client.utils.findChannel(channel.guild, config.channels.transcripts);
    if(aChannel) aChannel.send({ embeds: [logEmbed], files: [`transcripts/ticket-${ticketData?.id || randomIdCase}.txt`] });

    if(client.config.tickets.move_closed == true) {
      const moveCategory = client.utils.findChannel(channel.guild, client.config.channels.move_closed);

      channel.edit({ parent: moveCategory }).then(async(ch) => {
        for(const perm of ch.permissionOverwrites.cache) {
          if(perm[1].type == Discord.OverwriteType.Member) {
            if(perm[0] == ticketData?.owner) 
              ch.permissionOverwrites.delete(perm[0]);
          } 
        }

        let actionsButtons = new Discord.ActionRowBuilder().addComponents(
          new Discord.ButtonBuilder()
            .setCustomId("delete_ticket")
            .setLabel(client.language.buttons.delete_ticket)
            .setStyle(Discord.ButtonStyle.Danger)
            .setEmoji(client.config.emojis.delete_ticket)
        );

        await channel.send({ embeds: [client.embedBuilder(client, member.user, client.embeds.title, client.language.ticket.ticket_move_closed.replace("<user>", member.user.username), client.embeds.general_color)], components: [actionsButtons] });
      })
    } else {
      setTimeout(async() => {
        if(channel) await channel.delete();
      }, client.config.tickets.delete_after * 1000);
    }

    if(config.tickets.dm_transcript == true) {
      let dmEmbed = new Discord.EmbedBuilder()
        .setColor(client.embeds.dm_transcript.color);

      if(client.embeds.dm_transcript.title) dmEmbed.setTitle(client.embeds.dm_transcript.title);
      let field = client.embeds.dm_transcript.fields;
      for(let i = 0; i < client.embeds.dm_transcript.fields.length; i++) {
        dmEmbed.addFields([{ name: field[i].title, value: field[i].description.replace("<closedBy>", member.user.username)
          .replace("<closedById>", member.id)
          .replace("<ticketId>", `${ticketData?.id || randomIdCase}`)
          .replace("<author>", client.users.cache.get(ticketData?.owner)?.username)
          .replace("<authorId>", ticketData?.owner)
          .replace("<reason>", reason)
          .replace("<channelId>", channel.id)
          .replace("<channelName>", channel.name)
          .replace("<transcriptCode>", transcriptCode || "N/A")
          .replace("<openedAt>", `<t:${Math.round(ticketData?.openedTimestamp/1000)}:F>`)
          .replace("<closedAt>", `<t:${Math.round(new Date().getTime()/1000)}:F>`), inline: client.embeds.dm_transcript.inline }])
      }
      
      if(client.embeds.dm_transcript.footer == true) dmEmbed.setFooter({ text: member.user.username, iconURL: member.user.displayAvatarURL() }).setTimestamp();
      if(client.embeds.dm_transcript.thumbnail == true) dmEmbed.setThumbnail(member.user.displayAvatarURL());

      if(client.embeds.dm_transcript.description) dmEmbed.setDescription(client.embeds.dm_transcript.description.replace("<closedBy>", member.user.username)
        .replace("<closedById>", member.id)
        .replace("<ticketId>", `${ticketData?.id || randomIdCase}`)
        .replace("<author>", client.users.cache.get(ticketData?.owner)?.username)
        .replace("<authorId>", ticketData?.owner)
        .replace("<reason>", reason)
        .replace("<channelId>", channel.id)
        .replace("<channelName>", channel.name)
        .replace("<transcriptCode>", transcriptCode || "N/A")
        .replace("<openedAt>", `<t:${Math.round(ticketData?.openedTimestamp/1000)}:F>`)
        .replace("<closedAt>", `<t:${Math.round(new Date().getTime()/1000)}:F>`));

      let supportDM = await client.database.ticketsData().get(`${channel.id}.ticketClaimed`);
      let authorDM = client.users.cache.get(ticketData?.owner);
      supportDM = client.users.cache.get(supportDM);
      if(authorDM != undefined) {
        authorDM.send({ embeds: [dmEmbed], files: [`transcripts/ticket-${ticketData?.id || randomIdCase}.txt`] }).catch((err) => {
          console.error("Author's DM Closed");
        });
      }
      if(supportDM != undefined && supportDM != authorDM) {
        supportDM.send({ embeds: [dmEmbed], files: [`transcripts/ticket-${ticketData?.id || randomIdCase}.txt`] }).catch((err) => {
          console.error("Support's DM Closed");
        });
      }
    };
  });
}

module.exports = {
  htmlTranscript,
  textTranscript,
}