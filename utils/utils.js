const Discord = require("discord.js");
const { QuickDB } = require("quick.db");
const db = new QuickDB();
const fs = require("fs");
const chalk = require("chalk");
const FormData = require("form-data");
const fetch = require("node-fetch");
const yaml = require("yaml");
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const dom = new JSDOM();
const document = dom.window.document;
const config = yaml.parse(fs.readFileSync('./configs/config.yml', 'utf8'));
const language = yaml.parse(fs.readFileSync('./configs/language.yml', 'utf8'));

function formatTime(ms) {
  let roundNumber = ms > 0 ? Math.floor : Math.ceil;
  let days = roundNumber(ms / 86400000),
    hours = roundNumber(ms / 3600000) % 24,
    mins = roundNumber(ms / 60000) % 60,
    secs = roundNumber(ms / 1000) % 60;
  var time = (days > 0) ? `${days}d ` : "";
  time += (hours > 0) ? `${hours}h ` : "";
  time += (mins > 0) ? `${mins}m ` : "";
  time += (secs > 0) ? `${secs}s` : "0s";
  return time;
}

const capitalizeFirstLetter = (string) => string.charAt(0).toUpperCase() + string.slice(1);

const updateStats = async(client, guild) => {
  const guildCache = client.otherCache.get("guild");
  const countersCache = client.otherCache.get("counters");
  
  let currentTickets = guildCache?.currentTickets || 0;
  let claimedTickets = guildCache?.claimedTickets || 0;
  let totalTickets = guildCache?.ticketCount || 0;

  let chOpened = countersCache?.openedChannel;
  let chClaimed = countersCache?.claimedChannel;
  let chTotal = countersCache?.totalChannel;

  if(chOpened && guild.channels.cache.get(chOpened)) {
    let ch = guild.channels.cache.get(chOpened);
    ch.setName(ch.name.replace(/[0-9]/g, "") + currentTickets);
  }
  if(chClaimed && guild.channels.cache.get(chClaimed)) {
    let ch = guild.channels.cache.get(chClaimed);
    ch.setName(ch.name.replace(/[0-9]/g, "") + claimedTickets);
  }
  if(chTotal && guild.channels.cache.get(chTotal)) {
    let ch = guild.channels.cache.get(chTotal);
    ch.setName(ch.name.replace(/[0-9]/g, "") + totalTickets);
  }
}

const commandsList = (client, category) => {
  prefix = client.config.general.prefix;
  let commands = client.commands.filter(
    c => c.category == category && c.enabled == true
  );

  let loaded = [...commands.values()];
  let content = "";

  loaded.forEach(
    c => (content += `\`${c.name}\`, `)
  );
  if(content.length == 0) content = client.language.general.no_commands + ", ";

  return content.slice(0, -2);
}

const pushReview = async(client, userId, object) => {
  let history = await client.database.usersData().get(`${userId}.reviews`) || [];
  history.unshift(object);
  await client.database.usersData().set(`${userId}.reviews`, history);
}

const generateId = () => {
  let firstPart = (Math.random() * 46656) | 0;
  let secondPart = (Math.random() * 46656) | 0;
  firstPart = ("000" + firstPart.toString(36)).slice(-3);
  secondPart = ("000" + secondPart.toString(36)).slice(-3);

  return firstPart + secondPart;
}

const sendError = (error) => {
  console.log(chalk.red("[ERROR] ") + chalk.white(error));
  
  let errorMessage = `[${new Date().toLocaleString("en-GB")}] [ERROR] ${error}\n`;
  fs.appendFile("./errors.txt", errorMessage, (e) => {
    if(e) console.log(e);
  });
}

const sendWarn = (warn) => {
  console.log(chalk.keyword("orange")("[WARNING] ") + chalk.white(warn));

  let warnMessage = `[${new Date().toLocaleString("en-GB")}] [WARN] ${warn}\n`;
  fs.appendFile("./info.txt", warnMessage, (e) => {
    if(e) console.log(e);
  });
}

const sendInfo = (info) => {
  console.log(chalk.blue("[INFO] ") + chalk.white(info));
}

const findChannel = (guild, channel) => {
  if(channel == "") return undefined;

  return guild.channels.cache.find(ch => ch.name.toLowerCase().includes(`${channel}`.toLowerCase())) || guild.channels.cache.get(channel);
}

const usage = (client, message, validUsage) => {
  let embed = client.embedBuilder(client, message.member.user, client.embeds.title, client.language.general.usage.replace("<usage>", validUsage), client.embeds.error_color);
  return embed;
}

const findRole = (guild, role) => {
  if(role == "") return undefined;

  return guild.roles.cache.find(r => r.name.toLowerCase().includes(`${role}`.toLowerCase())) || guild.roles.cache.get(role);
}

const hasRole = (client, guild, member, roles, checkEmpty = false) => {
  if(checkEmpty == true && roles.length == 0) return true;

  let arr = roles.map((x, i) => {
    let findPerm = client.utils.findRole(guild, `${x}`.toLowerCase());
    if(!findPerm) return false;
    if(member.roles.cache.has(findPerm.id)) return true;

    return false;
  });
  if(checkEmpty == true && arr.length == 0) return true;

  return arr.includes(true) ? true : false;
}

const hasPermissions = (message, member, permList) => {
  if(permList.length == 0) return true;
  
  let userPerms = [];
  permList.forEach((perm) => {
    if(!Discord.PermissionFlagsBits[perm]) return userPerms.push(true);
    if(!message.channel.permissionsFor(member).has(perm)) return userPerms.push(false);
    else return userPerms.push(true);
  });

  return userPerms.includes(true) ? true : false;
}

const filesCheck = () => {
  if(!fs.existsSync('./info.txt')) {
    fs.open('./info.txt', 'w', function(err, file) {
      if(err) sendError("Couldn't create file (info.txt)");
      sendInfo("File (info.txt) doesn't exist, creating it.");
    });
  }
  if(!fs.existsSync('./errors.txt')) {
    fs.open('./errors.txt', 'w', function(err, file) {
      if(err) sendError("Couldn't create file (errors.txt)");
      sendInfo("File (errors.txt) doesn't exist, creating it.");
    });
  }
  if(!fs.existsSync('./transcripts')) {
    fs.mkdir('./transcripts', function(err) {
      if(err) sendError("Couldn't create folder (transcripts)");
      sendInfo("Folder (transcripts) doesn't exist, creating it.");
    })
  }
  if(!fs.existsSync('./products')) {
    fs.mkdir('./products', function(err) {
      if(err) sendError("Couldn't create folder (products)");
      sendInfo("Folder (products) doesn't exist, creating it.");
    })
  }
  if(!fs.existsSync('./addons')) {
    fs.mkdir('./addons', function(err) {
      if(err) sendError("Couldn't create folder (addons)");
      sendInfo("Folder (addons) doesn't exist, creating it.");
    })
  }
}

const generateTranscript = async (client, channel, msgs, ticket, save = true) => {
  let attachSize = 0;
  let htmlContainer = "";
  let ticketData = await client.database.ticketsData().get(`${channel.id}.ticketData`);
  let ticketOwner = client.users.cache.get(ticketData?.owner) || "n/a";
  let data = await fs.readFileSync('./data/template.html', {
    encoding: 'utf-8'
  });
  if(save == true) {
    await fs.writeFileSync(`transcripts/ticket-${ticket}.html`, data);
  } else {
    htmlContainer += data;
  }

  let guildElement = document.createElement('div');

  let guildNameEl = document.createElement("span");
  let guildText = document.createTextNode(channel.guild.name);

  let openEl = document.createElement("span");
  let openText = document.createTextNode(language.ticket.creation + '' + new Date(parseInt(ticketData?.openedTimestamp || new Date().getTime())).toLocaleString("en-GB") || 'N/A')
  openEl.appendChild(openText);
  openEl.style = `display: flex; padding-top: 15px; font-size: 15px;`

  let closeEl = document.createElement("span");
  let closeText = document.createTextNode(language.ticket.closing + '' + new Date().toLocaleString("en-GB") || 'N/A');
  if(save == false) closeText = document.createTextNode('Current Time' + new Date().toLocaleString("en-GB") || 'N/A')
  closeEl.appendChild(closeText);
  closeEl.style = `display: flex; padding-top: 5px; font-size: 15px;`

  guildNameEl.appendChild(guildText);
  guildNameEl.appendChild(openEl)
  guildNameEl.appendChild(closeEl)
  guildNameEl.style = `margin-left: 43px`
  guildNameEl.style = `margin-top: 45px`

  let guildImg = document.createElement('img');
  guildImg.setAttribute('src', channel.guild.iconURL());
  guildImg.setAttribute('width', '128');
  guildImg.className = "guild-image";
  guildElement.appendChild(guildImg);
  guildElement.appendChild(guildNameEl);
  guildElement.style = "display: flex";
  guildElement.setAttribute("transcript-user-id", ticketData?.owner);
  guildElement.setAttribute("transcript-user-username", ticketOwner);
  if(save == true) {
    await fs.appendFileSync(`transcripts/ticket-${ticket}.html`, guildElement.outerHTML, (err) => {
      if(err) console.log(err)
    });
  } else {
    htmlContainer += guildElement.outerHTML;
  }

  for(const msg of msgs) {
    let parentContainer = document.createElement("div");
    parentContainer.className = "parent-container";

    let avatarDiv = document.createElement("div");
    avatarDiv.className = "avatar-container";
    let img = document.createElement('img');
    img.setAttribute('src', msg.author.displayAvatarURL());
    img.className = "avatar";
    avatarDiv.appendChild(img);

    parentContainer.appendChild(avatarDiv);

    let messageContainer = document.createElement('div');
    messageContainer.className = "message-container";

    let nameElement = document.createElement("span");
    let name = document.createTextNode(`${msg.author.username} `)
    let dateSpan = document.createElement("span");
    let dateText = document.createTextNode(`${msg.createdAt.toLocaleString("en-GB")}`)
    dateSpan.appendChild(dateText)
    dateSpan.style = `font-size: 12px; color: #c4c4c4;`
    nameElement.appendChild(name);
    nameElement.appendChild(dateSpan)
    nameElement.style = `padding-bottom: 10px`
    messageContainer.append(nameElement);

    let msgNode = document.createElement('span');
    if(msg.content && msg.type != Discord.MessageType.ThreadCreated) 
      msgNode.innerHTML = replaceFormatting(channel.guild, msg.content);

    if(msg.type == Discord.MessageType.ThreadCreated && msg.hasThread) {
      let answersCollapseNode = document.createElement('div');
      let answersListNode = document.createElement('div');
      answersListNode.classList.add("collapse-panel");
      
      let answersToggle = document.createElement('button');
      answersToggle.textContent = language.ticket.answers_thread_name;
      answersToggle.classList.add('collapse-button');
      
      answersToggle.setAttribute("onclick", "toggleAnswers()");

      answersCollapseNode.append(answersToggle);

      let messageCollection = new Discord.Collection();
      let channelMessages = await msg.thread.messages.fetch({ limit: 100 });
    
      messageCollection = messageCollection.concat(channelMessages);
    
      while(channelMessages.size === 100) {
        let lastMessageId = channelMessages.lastKey();
        channelMessages = await msg.thread.messages.fetch({ limit: 100, before: lastMessageId });
        if(channelMessages) messageCollection = messageCollection.concat(channelMessages);
      }
      
      let threadMessages = [...messageCollection.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp)

      threadMessages.forEach((tMsg) => {
        let answerText = document.createElement('span');
        answerText.innerHTML = replaceFormatting(msg.guild, tMsg.content);
        answerText.style.marginBottom = 0;
        answerText.style.marginTop = 0;

        answersListNode.append(answerText);
      });

      answersCollapseNode.append(answersListNode);

      messageContainer.appendChild(answersCollapseNode);
    }

    if(msg.attachments && msg.attachments.size > 0 && config.tickets.save_images == true) {
      for (const attachment of Array.from(msg.attachments.values())) {
        const attDiv = document.createElement("div");
        attDiv.classList.add("chat-image");

        const attachmentType = (attachment.name ?? 'unknown.png')
          .split('.')
          .pop()
          .toLowerCase();

        const formats = ["png", "jpg", "jpeg", "webp", "gif"];
        if(formats.includes(attachmentType)) {
          attachSize += attachment.size;
          const attLink = document.createElement("a");
          const attImg = document.createElement("img");

          attImg.classList.add("chat-media");
          attImg.src = await getImage(attachment.proxy_url ?? attachment.url) ?? attachment.proxy_url ?? attachment.url;

          attImg.alt = "Transcript Image";

          attLink.appendChild(attImg);
          attDiv.appendChild(attLink);

          msgNode.appendChild(attDiv)
        }
      }
    } else if(msg.attachments && msg.attachments.size > 0 && config.tickets.save_images == false) {
      msgNode.append(`[ATTACHMENT]`);
    }

    messageContainer.appendChild(msgNode);
    
    if(msg.embeds[0]) {
      let fields = [];
      if(msg.embeds[0].data.fields) {
        for (let i = 0; i < msg.embeds[0].data.fields.length; i++) {
          fields.push(
            `<b><font size="+1">${msg.embeds[0].data.fields[i].name}</font></b><br>${replaceFormatting(msg.guild, msg.embeds[0].data.fields[i].value)}<br>`
          )
        }
      }
      let msgEmbed = msg.embeds[0];
      let embedNode = document.createElement("div");
      embedNode.className = "embed";

      let colorNode = document.createElement("div");
      const dataColor = msgEmbed.data.color;
      const formatColor = Number(dataColor).toString(16);

      colorNode.className = "embed-color";
      colorNode.style = `background-color: #${`${dataColor}`.length == 3 ? `0000${formatColor}` : formatColor}`;
      embedNode.appendChild(colorNode);

      let embedContent = document.createElement("div");
      embedContent.className = "embed-content";

      let titleNode = document.createElement("span");
      titleNode.className = "embed-title";
      titleNode.innerHTML = msgEmbed.data.title || msgEmbed.data.author?.name || " ";
      embedContent.appendChild(titleNode);

      if(msgEmbed.data.fields) {
        if(!msgEmbed.data.description) msgEmbed.data.description = "";
        let descNode = document.createElement("span");
        descNode.className = "embed-description";
        descNode.innerHTML = replaceFormatting(channel.guild, msgEmbed.data.description) + "<br><br>" + fields.join("<br>");
        embedContent.appendChild(descNode);
      } else {
        if(!msgEmbed.data.description) msgEmbed.data.description = "";
        let descNode = document.createElement("span");
        descNode.className = "embed-description";
        descNode.innerHTML = replaceFormatting(channel.guild, msgEmbed.data.description);
        embedContent.appendChild(descNode);
      }

      if(msgEmbed.data.footer?.text) {
        const footerNode = document.createElement("div");
        footerNode.classList.add("embed-footer");

        if(msgEmbed.data.footer.icon_url) {
          const footerIconNode = document.createElement("img");
          footerIconNode.classList.add("embed-footer-icon");
          footerIconNode.src = msgEmbed.data.footer.proxy_icon_url ?? msgEmbed.data.footer.icon_url;
          footerIconNode.alt = 'Footer icon';
          footerIconNode.loading = 'lazy';

          footerNode.appendChild(footerIconNode);
        }

        const footerTextNode = document.createElement("span");
        footerTextNode.classList.add("embed-footer-text");
        footerTextNode.textContent = msgEmbed.data.timestamp ? `${msgEmbed.data.footer.text} • ${new Date(msgEmbed.data.timestamp).toLocaleString()}` : msgEmbed.data.footer.text;
        
        footerNode.appendChild(footerTextNode);
        embedContent.appendChild(footerNode);
      }

      embedNode.appendChild(embedContent);
      
      if(msgEmbed.data.thumbnail) {
        const thumbnailNode = document.createElement("div");
        thumbnailNode.classList.add("embed-thumbnail-container");

        const thumbnailNodeLink = document.createElement("a");
        thumbnailNodeLink.classList.add("embed-thumbnail-link");
        thumbnailNodeLink.href = msgEmbed.data.thumbnail.proxy_url ?? msgEmbed.data.thumbnail.url;

        const thumbnailNodeImage = document.createElement("img");
        thumbnailNodeImage.classList.add("embed-thumbnail");
        thumbnailNodeImage.src = msgEmbed.data.thumbnail.proxy_url ?? msgEmbed.data.thumbnail.url;
        thumbnailNodeImage.loading = "lazy";
        thumbnailNodeImage.alt = "Embed Thumbnail";

        thumbnailNodeLink.appendChild(thumbnailNodeImage);
        thumbnailNode.appendChild(thumbnailNodeLink);

        embedNode.appendChild(thumbnailNode);
      }

      if(msgEmbed.data.image) {
        const imageNode = document.createElement("div");
        imageNode.classList.add("embed-image-container");

        const imageNodeLink = document.createElement("a");
        imageNodeLink.classList.add("embed-image-link");
        imageNodeLink.href = msgEmbed.data.image.proxy_url ?? msgEmbed.data.image.url;

        const imageNodeImage = document.createElement("img");
        imageNodeImage.classList.add("embed-image");
        imageNodeImage.src = msgEmbed.data.image.proxy_url ?? msgEmbed.data.image.url;
        imageNodeImage.alt = "Embed Image";
        imageNodeImage.loading = "lazy";

        imageNodeLink.appendChild(imageNodeImage);
        imageNode.appendChild(imageNodeLink);

        embedContent.appendChild(imageNode);
    } 

      messageContainer.append(embedNode);
    }

    parentContainer.appendChild(messageContainer);
    if(save == true) {
      await fs.appendFileSync(`transcripts/ticket-${ticket}.html`, parentContainer.outerHTML, (err) => {
        if(err) console.log(err)
      });
    } else {
      htmlContainer += parentContainer.outerHTML;
    };
  };
  if(attachSize >= 6815744) {
    config.tickets.save_images = false;
    return await generateTranscript(client, channel, msgs, ticket, save).then(() => {
      config.tickets.save_images = true;
    });
  }
  if(save == false) return htmlContainer;
}

const channelRoleCheck = (client, usedGuild, foundWarn) => {
  const config = client.config;
  if(client.config.tickets.separate_roles.enabled == true && client.categories.length > 0) {
    for (let i = 0; i < client.categories.length; i++) {
      if(!client.categories[i].roles) continue;
      if(client.categories[i].roles.length == 0) continue;
      let findRole = client.categories[i].roles.map((x) => client.utils.findRole(usedGuild, x));

      if(findRole.includes("undefined") || findRole.includes(undefined)) {
        client.utils.sendWarn(`One or more Category Roles (categories.${client.categories[i].id}.roles) provided are invalid or belongs to other Server.`);
        foundWarn.push("Invalid Category Role");
        break;
      }
    }
  }
  if(client.config.roles.support.length > 0) {
    for (let i = 0; i > client.config.roles.support.length; i++) {
      let findRole = client.utils.findRole(usedGuild, client.config.roles.support[i]);
      if(!findRole) {
        client.utils.sendWarn(`One or more Support Roles (roles.support - ${client.config.roles.support[i]}) provided are invalid or belongs to other Server.`);
        foundWarn.push("Invalid Support Role(s)");
        break;
      }
    }
  }
  if(client.config.roles.bypass.cooldown.length > 0) {
    for (let i = 0; i > client.config.roles.bypass.cooldown.length; i++) {
      let findRole = client.utils.findRole(usedGuild, client.config.roles.bypass.cooldown[i]);
      if(!findRole) {
        client.utils.sendWarn(`One or more Cooldown Bypass Roles (roles.bypass.cooldown - ${client.config.roles.bypass.cooldown[i]}) provided are invalid or belongs to other Server.`);
        foundWarn.push("Invalid Cooldown Bypass Role(s)");
        break;
      }
    }
  }
  if(client.config.roles.bypass.permission.length > 0) {
    for (let i = 0; i > client.config.roles.bypass.permission.length; i++) {
      let findRole = client.utils.findRole(usedGuild, client.config.roles.bypass.permission[i]);
      if(!findRole) {
        client.utils.sendWarn(`One or more Permission Bypass Roles (roles.bypass.permission - ${client.config.roles.bypass.permission[i]}) provided are invalid or belongs to other Server.`);
        foundWarn.push("Invalid Permission Bypass Role(s)");
        break;
      }
    }
  }
  if(client.config.sellix.separateProducts.enabled == true && client.config.sellix.products > 0) {
    for (let i = 0; i < client.config.sellix.products.length; i++) {
      if(client.config.sellix.products[i].roles.length == 0) continue;
      let findRole = client.config.sellix.products[i].roles.map((x) => client.utils.findRole(usedGuild, x));

      if(findRole.includes("undefined") || findRole.includes(undefined)) {
        client.utils.sendWarn(`One or more Sellix Product Verification Roles (sellix.products.PRODUCT.roles) provided are invalid or belongs to other Server.`);
        foundWarn.push("Invalid Sellix Verification Role(s)");
        break;
      }
    }
  }
  if(config.channels.transcripts != "") {
    let findChannel = client.utils.findChannel(usedGuild, config.channels.transcripts);
    if(!findChannel) {
      client.utils.sendWarn("Transcripts Channel Name/ID (transcripts) provided is invalid or belongs to other Server.");
      foundWarn.push("Invalid Transcripts Channel");
    }
  }
  if(config.channels.suggestions != "") {
    let findChannel = client.utils.findChannel(usedGuild, config.channels.suggestions);
    if(!findChannel) {
      client.utils.sendWarn("Suggestions Channel Name/ID (suggestions) provided is invalid or belongs to other Server.");
      foundWarn.push("Invalid Suggestions Channel");
    }
  }
  if(config.channels.sugg_logs != "" && config.general.sugg_decision == true) {
    let findChannel = client.utils.findChannel(usedGuild, config.channels.sugg_logs);
    if(!findChannel) {
      client.utils.sendWarn("Suggestion Logs Channel Name/ID (sugg_logs) provided is invalid or belongs to other Server.");
      foundWarn.push("Invalid Suggestions Logs Channel");
    }
  }
  if(config.channels.sugg_decision != "" && config.general.sugg_decision == true) {
    let findChannel = client.utils.findChannel(usedGuild, config.channels.sugg_logs);
    if(!findChannel) {
      client.utils.sendWarn("Suggestion Decision Channel Name/ID (sugg_decision) provided is invalid or belongs to other Server.");
      foundWarn.push("Invalid Suggestions Decision Channel");
    }
  }
  if(config.channels.announce != "") {
    let findChannel = client.utils.findChannel(usedGuild, config.channels.announce);
    if(!findChannel) {
      client.utils.sendWarn("Auto Announcements Channel Name/ID (announce) provided is invalid or belongs to other Server.");
      foundWarn.push("Invalid Auto Announcements Channel");
    }
  }
  if(config.channels.reviews != "") {
    let findChannel = client.utils.findChannel(usedGuild, config.channels.reviews);
    if(!findChannel) {
      client.utils.sendWarn("Reviews Channel Name/ID (reviews) provided is invalid or belongs to other Server.");
      foundWarn.push("Invalid Reviews Channel");
    }
  }
  if(!Array.isArray(client.config.roles.support)) {
    client.utils.sendWarn("Config field for Support Roles (roles.support) is not of proper type (Array).");
    foundWarn.push("Invalid Support Roles Config Field Type");
  }
  if(!Array.isArray(client.config.roles.blacklist)) {
    client.utils.sendWarn("Config field for Blacklisted Users (roles.blacklist) is not of proper type (Array).");
    foundWarn.push("Invalid Blacklisted Users Config Field Type");
  }
  if(!Array.isArray(client.config.roles.bypass.cooldown)) {
    client.utils.sendWarn("Config field for Cooldown Bypass (roles.bypass.cooldown) is not of proper type (Array).");
    foundWarn.push("Invalid Cooldown Bypass Config Field Type");
  }
  if(!Array.isArray(client.config.roles.bypass.permission)) {
    client.utils.sendWarn("Config field for Permission Bypass (roles.bypass.permission) is not of proper type (Array).");
    foundWarn.push("Invalid Permission Bypass Config Field Type");
  }
}

const ticketUsername = (user) => {
  const regex = /[^a-z0-9]+/g
  if(!user)
    return 'user';
  const format = user.username.toLowerCase().replace(regex, "");
  return format == "" ? `${user.id}` : format;
}

const ticketPlaceholders = (string, user, ticket) => {
  if(ticket < 10) ticket = "000" + ticket;
  else if(ticket >= 10 && ticket < 100) ticket = "00" + ticket
  else if(ticket >= 100 && ticket < 1000) ticket = "0" + ticket
  else if(ticket >= 1000) ticket = ticket;

  return string.toLowerCase().replace("<username>", ticketUsername(user)).replace("<ticket>", ticket);
}

const downloadProduct = async (client, message, product) => {
  let productList = yaml.parse(fs.readFileSync('./configs/products.yml', 'utf8'));
  if(productList.products[product].type == "FILE") {
    const formData = new FormData();
		formData.append("maxDownloads", parseInt(client.config.products.limit_download));
		formData.append("autoDelete", "true");
		formData.append(
			"file",
			fs.createReadStream(`products/${productList.products[product].product}`),
		);
	
		await fetch(`https://file.io/?expires=${client.config.products.delete_download}`, {
			method: "POST",
			body: formData,
			headers: {
				Accept: "application/json",
			},
		}).then(async(res) => {
      const data = await res.json();

      const row = new Discord.ActionRowBuilder()
        .addComponents(
          new Discord.ButtonBuilder()
          .setStyle(Discord.ButtonStyle.Primary)
          .setLabel(client.language.buttons.download)
          .setEmoji(client.config.emojis.file || {})
          .setCustomId('downloadFiles'),
        );

      if(message.type == Discord.InteractionType.ApplicationCommand) {
        m = await message.editReply({ embeds: [client.embedBuilder(client, message.member.user, client.embeds.title, client.language.products.download_get.replace("<file>", `${productList.products[product].name}`), client.embeds.success_color)], components: [row], flags: client.cmdConfig.getproduct.ephemeral ? Discord.MessageFlags.Ephemeral : 0 });
      } else {
        m = await message.channel.send({ embeds: [client.embedBuilder(client, message.member.user, client.embeds.title, client.language.products.download_get.replace("<file>", `${productList.products[product].name}`), client.embeds.success_color)], components: [row], flags: client.cmdConfig.getproduct.ephemeral ? Discord.MessageFlags.Ephemeral : 0 });
      }
      const filter = (interaction) => interaction.customId == 'downloadFiles' && interaction.user.id == message.member.user.id;
      await message.channel.awaitMessageComponent({ filter, componentType: Discord.ComponentType.Button, max: 1 }).then(async (i) => {
        await i.deferUpdate({ flags: Discord.MessageFlags.Ephemeral });
        const downloadFile = new Discord.ActionRowBuilder()
          .addComponents(
            new Discord.ButtonBuilder()
            .setStyle(Discord.ButtonStyle.Link)
            .setLabel(client.language.buttons.download)
            .setEmoji(client.config.emojis.file || {})
            .setURL(data.link)
          );
        await i.followUp({ embeds: [client.embedBuilder(client, message.member.user, client.embeds.title, client.language.products.download.replace("<file>", `${productList.products[product].name}`), client.embeds.success_color)], components: [downloadFile], flags: Discord.MessageFlags.Ephemeral })
      });
    }).catch((err) => {
      client.utils.sendError(err);
      if(message.type == Discord.InteractionType.ApplicationCommand) {
        message.reply({ embeds: [client.embedBuilder(client, message.member.user, client.embeds.title, client.language.products.error, client.embeds.error_color)], flags: Discord.MessageFlags.Ephemeral })
      } else {
        message.channel.send({ embeds: [client.embedBuilder(client, message.author, client.embeds.title, client.language.products.error, client.embeds.error_color)] })
      }
    });
  } else if(productList.products[product].type == "LINK") {
    const row = new Discord.ActionRowBuilder()
      .addComponents(
        new Discord.ButtonBuilder()
        .setStyle(Discord.ButtonStyle.Primary)
        .setLabel(client.language.buttons.link)
        .setEmoji(client.config.emojis.link || {})
        .setCustomId('getLink'),
      );

    if(message.type == Discord.InteractionType.ApplicationCommand) {
      message.reply({ embeds: [client.embedBuilder(client, message.member.user, client.embeds.title, client.language.products.link_get.replace("<link>", `${productList.products[product].name}`), client.embeds.success_color)], components: [row] });
    } else {
      message.channel.send({ embeds: [client.embedBuilder(client, message.member.user, client.embeds.title, client.language.products.link_get.replace("<link>", `${productList.products[product].name}`), client.embeds.success_color)], components: [row] });
    }
    const filter = (interaction) => interaction.customId == 'getLink' && interaction.user.id == message.member.user.id;
    await message.channel.awaitMessageComponent({ filter, componentType: Discord.ComponentType.Button, max: 1 }).then(async (i) => {
      await i.deferUpdate({ flags: Discord.MessageFlags.Ephemeral });
      const visitLink = new Discord.ActionRowBuilder()
        .addComponents(
          new Discord.ButtonBuilder()
          .setStyle(Discord.ButtonStyle.Link)
          .setLabel(client.language.buttons.link)
          .setEmoji(client.config.emojis.link || {})
          .setURL(`${productList.products[product].product}`)
        );
      await i.followUp({ embeds: [client.embedBuilder(client, message.member.user, client.embeds.title, client.language.products.link.replace("<link>", `${productList.products[product].name}`), client.embeds.success_color)], components: [visitLink], flags: Discord.MessageFlags.Ephemeral })
    });
  }
}

const isTicket = async(client, channel) => {
  const ticketData = await client.database.ticketsData().get(`${channel.id}.ticketData`);
  return ticketData != null && ticketData != undefined ? true : false;
}

const updateSuggestionEmbed = async (client, interaction) => {
  let suggData = await client.database.suggestionsData().get(`${interaction.message.id}`);
  let suggChannel = client.utils.findChannel(interaction.guild, client.config.channels.suggestions);
  let decisionChannel = client.utils.findChannel(interaction.guild, client.config.channels.sugg_decision);

  let suggMenu = new Discord.EmbedBuilder()
    .setColor(client.embeds.suggestion.color);

  if(client.embeds.suggestion.title) suggMenu.setTitle(client.embeds.suggestion.title);
  let field = client.embeds.suggestion.fields;
  for (let i = 0; i < client.embeds.suggestion.fields.length; i++) {
    suggMenu.addFields([{ name: field[i].title, value: field[i].description.replace("<author>", suggData.author.username)
      .replace("<suggestion>", suggData.text)
      .replace("<yes_vote>", suggData.yes)
      .replace("<no_vote>", suggData.no)
      .replace("<date>", suggData.date), inline: client.embeds.suggestion.inline }])
  }

  if(client.embeds.suggestion.footer == true) suggMenu.setFooter({ text: suggData.author.username, iconURL: suggData.author.avatar }).setTimestamp();
  if(client.embeds.suggestion.thumbnail == true) suggMenu.setThumbnail(interaction.guild.iconURL());

  if(client.embeds.suggestion.description) suggMenu.setDescription(client.embeds.suggestion.description.replace("<author>", `<@!${suggData.author.id}>`)
    .replace("<suggestion>", suggData.text)
    .replace("<yes_vote>", suggData.yes)
    .replace("<no_vote>", suggData.no)
    .replace("<date>", suggData.date));

  let suggRow = new Discord.ActionRowBuilder().addComponents(
    new Discord.ButtonBuilder()
      .setLabel(client.language.buttons.yes_vote.replace("<count>", suggData.yes))
      .setEmoji(client.config.emojis.yes_emoji || {})
      .setCustomId("vote_yes")
      .setStyle(Discord.ButtonStyle.Primary),
    new Discord.ButtonBuilder()
      .setLabel(client.language.buttons.no_vote.replace("<count>", suggData.no))
      .setEmoji(client.config.emojis.no_emoji || {})
      .setCustomId("vote_no")
      .setStyle(Discord.ButtonStyle.Danger),
    new Discord.ButtonBuilder()
      .setLabel(client.language.buttons.remove_vote)
      .setEmoji(client.config.emojis.remove_vote || {})
      .setCustomId("vote_reset")
      .setStyle(Discord.ButtonStyle.Secondary)
  );

  let decisionRow = new Discord.ActionRowBuilder().addComponents(
    new Discord.StringSelectMenuBuilder()
    .setCustomId("decision_menu")
    .setPlaceholder(client.language.general.suggestions.placeholder)
    .addOptions([{
      label: client.language.general.suggestions.decision.accept,
      value: "decision_accept",
      emoji: client.config.emojis.yes_emoji
      }, {
      label: client.language.general.suggestions.decision.deny,
      value: "decision_deny",
      emoji: client.config.emojis.no_emoji
      }, {
      label: client.language.general.suggestions.decision.delete,
      value: "decision_delete",
      emoji: client.config.emojis.remove_vote
      }])
  );

  let suggMessage = await suggChannel.messages.fetch({ message: interaction.message.id });
  await suggMessage.edit({ embeds: [suggMenu], components: [suggRow] });
  if(client.config.channels.sugg_decision && client.config.general.sugg_decision) {
    let decisionMessage = await decisionChannel.messages.fetch({ message: suggData.decision });
    if(decisionMessage) await decisionMessage.edit({ embeds: [suggMenu], components: [decisionRow] });
  }
}

const databaseChecks = async(client, guildData) => {
  sendInfo("Doing some database tasks, this is usual and will take few seconds, don't worry.");

  if(client.config.general.database.type == "mongo") {
    //== Add Transcripts to Cache for faster loading on Dashboard ==//
    const allTranscripts = (await client.database.transcriptsData().all());
    if(allTranscripts.length > 0) {
      allTranscripts.forEach((t) => {
        client.transcriptsCache.set(t.id, {
          id: t.id,
          owner: t.owner,
          code: t.value?.code ?? t.code,
          date: t.date
        });
      });
    }

    //== Add Invoices to Cache ==//
    const allInvocies = (await client.database.invoicesData().all());
    if(allInvocies.length > 0) {
      allInvocies.forEach((invoice) => {
        client.transcriptsCache.set(invoice.id, invoice.value ?? invoice);
      });
    }
  }

  //== Add Counters to Cache ==//
  client.otherCache.set("counters", {
    openedChannel: guildData?.counters?.openedChannel,
    totalChannel: guildData?.counters?.totalChannel,
    claimedChannel: guildData?.counters?.claimedChannel
  });

  //== Delete invalid Tickets from Database ==//
  const allTickets = (await client.database.ticketsData().all());
  allTickets.forEach(async(t) => {
    const channel = await client.channels.cache.get(t.id);
    if(!channel)
      await client.database.ticketsData().delete(t.id);
  });

  //== Remove Tickets from User if there is no channel ==//
  const allUsers = (await client.database.usersData().all());

   allUsers.forEach(async(usr) => {
    const usrId = usr.id;
    usr = usr.value ?? usr;

    if(usr.choosingCategory == true)
      await client.database.usersData().set(`${usrId}.choosingCategory`, false);
    
    if(usr?.tickets && usr?.tickets?.length > 0) {
      usr.tickets.forEach(async(u) => {
        const channel = await client.channels.cache.get(u.channel);
        if(!channel) {
          usr.tickets = usr.tickets.filter((x) => x.channel != u.channel);
            await client.database.usersData().set(`${usrId}.tickets`, usr.tickets);
        }
      });
    }
  });
}

const canEditName = async(guild, channel) => {
  let canEdit = true;
  await guild.fetchAuditLogs({ type: Discord.AuditLogEvent.ChannelUpdate }).then((audit) => {
    let aLogs = audit.entries.filter((x) => x.target?.id == channel.id)
      .map((x) => x?.changes.find((c) => c?.key == "name") ? x?.createdTimestamp : undefined).filter(Boolean);
    if(aLogs.length > 0) {
      let passedTen = new Date() - new Date(aLogs[0]);
      if(passedTen > 660_000) canEdit = true;
      else canEdit = false;
    }
  });

  return canEdit;
}

const commissionAccess = (client, channel, guild) => {
  const channelAccess = channel.permissionOverwrites.cache.map((o) => o)
    .filter((r) => r.id != guild.id);

  channelAccess.forEach((a) => {
    if(a.type == Discord.OverwriteType.Role) {
      if(!client.config.roles.commission_access.some((r) => findRole(guild, r)?.id == a.id)) {
        channel.permissionOverwrites.delete(a.id);
      }
    }
  });

  client.config.roles.commission_access.forEach((cr) => {
    const findCommAccess = findRole(guild, cr);
    channel.permissionOverwrites.create(findCommAccess, {
      SendMessages: true,
      ViewChannel: true
    });
  });
}

const priceWithTax = (client, basePrice) => {
  if(!client.config.paypal.taxes || client.config.paypal.taxes?.length == 0) return basePrice;
  let appliedTaxes = 0;
  client.config.paypal.taxes.forEach((t) => {
    if(t.type == "NUMBER") {
      appliedTaxes += Number(Number(t.amount).toFixed(2));
    } else if(t.type == "PERCENT") {
      appliedTaxes += Number(((Number(basePrice) * Number(t.amount)) / 100).toFixed(2));
    }
  });

  return Number(basePrice += Number(appliedTaxes.toFixed(2))).toFixed(2);
}

const getImage = async(url) => {
  return await fetch(url).then(async(res) => {
    const buffer = await res.arrayBuffer();
    const stringifiedBuffer = Buffer.from(buffer).toString("base64");
    const contentType = res.headers.get("content-type");
    return `data:image/${contentType};base64,${stringifiedBuffer}`;
  }).catch(console.log);
}

const replaceFormatting = (guild, text) => {
  return text.replaceAll(/\*\*(.+)\*\*/g, '<b>$1</b>')
    .replaceAll(/^\*\s(.+)/gm, ' • $1')
    .replaceAll(/^###\s(.+)/g, '<h3 style="margin-bottom: 0;">$1</h3>')
    .replaceAll(/^##\s(.+)/g, '<h2 style="margin-bottom: 0;">$1</h2>')
    .replaceAll(/^#\s(.+)/g, '<h1 style="margin-bottom: 0;">$1</h1>')
    .replaceAll(/\*\*\*(.+)\*\*\*/g, "<i><b>$1</b></i>")
    .replaceAll(/\*(.\n+)\*/g, "<i>$1</i>")
    .replaceAll(/```(.+?)```/gs, (code) => `<div class="codeblock" style="white-space: pre-wrap; font-size: 11px; margin-top: 3px">${code.slice(3, -3)}</div>`)
    .replaceAll(/\n/g, "<br>")
    .replaceAll(/<@[!]?\d{18}>/g, (user) => guild.members.cache.get(user.match(/\d+/) ? user.match(/\d+/)[0] : '')?.user.username || 'invalid-user')
    .replaceAll(/<@&\d{18}>/g, (role) => guild.roles.cache.get(role.match(/\d+/) ? role.match(/\d+/)[0] : '')?.name || 'deleted-role')
    .replaceAll(/<#\d{18}>/g, (channel) => guild.channels.cache.get(channel.match(/\d+/) ? channel.match(/\d+/)[0] : '')?.name || 'deleted-channel')
    .replaceAll(/<:(.+):(\d+)>/g, (a, b, c) => `<img src="https://cdn.discordapp.com/emojis/${c}.webp?size=96&quality=lossless" width="${(/^<:(.+):(\d+)>$/).test(text) ? "48px" : "22px"}" height="${(/^<:(.+):(\d+)>$/).test(text) ? "48px" : "22px"}">`)
    .replaceAll(/<a:(.+):(\d+)>/g, (a, b, c) => `<img src="https://cdn.discordapp.com/emojis/${c}.gif?size=96&quality=lossless" width="${(/^<a:(.+):(\d+)>$/).test(text) ? "48px" : "22px"}" height="${(/^<a:(.+):(\d+)>$/).test(text) ? "48px" : "22px"}">`);
}

const dashboardFormat = (text) => {
  if(!text) text = "";
  return text.replaceAll(/\*{2}(.*?)\*{2}/g, '<span class="fw-bold">$1</span>');
}

const isUnavailable = async(client) => {
  const timezone = client.config.general.timezone;
  const availability = client.config.tickets.availability;
  const fetchTimezone = await fetch(`https://timeapi.io/api/Time/current/zone?timeZone=${timezone}`).then((async(res) => await res.json())).catch((err) => console.log(err));
  const early = fetchTimezone.time < availability.split("-")[0];
  const late = fetchTimezone.time > availability.split("-")[1];

  return {
    unavailable: early || late,
    start: availability.split("-")[0],
    end: availability.split("-")[1] 
  }
}

const serverLogs = async(client, object) => {
  let serverLogs = await client.database.guildData().get(`${client.config.general.guild}.serverLogs`) || [];
  if(config.server.dashboard.save_logs == true) {
    if(serverLogs.length >= 120) {
      serverLogs = serverLogs.slice(0, 120);
      await client.database.guildData().set(`${client.config.general.guild}.serverLogs`, serverLogs);
    }
    await client.database.guildData().push(`${client.config.general.guild}.serverLogs`, object);
  }
}

const dashboardLogs = async(client, object) => {
  let dashboardLogs = await client.database.guildData().get(`${client.config.general.guild}.dashboardLogs`) || [];
  if(config.server.dashboard.save_logs == true) {
    if(dashboardLogs.length >= 120) {
      dashboardLogs = dashboardLogs.slice(0, 120);
      await client.database.guildData().set(`${client.config.general.guild}.dashboardLogs`, dashboardLogs);
    }
    await client.database.guildData().push(`${client.config.general.guild}.dashboardLogs`, object);
  }
}

const colorFormatConvert = (col) => {
  const colors = {
    "Default": "#000000",
    "Aqua": "#1ABC9C",
    "DarkAqua": "#11806A",
    "Green": "#57F287",
    "DarkGreen": "#1F8B4C",
    "Blue": "#3498DB",
    "DarkBlue": "#206694",
    "Purple": "#9B59B6",
    "DarkPurple": "#71368A",
    "LuminousVividPink": "#E91E63",
    "DarkVividPink": "#AD1457",
    "Gold": "#F1C40F",
    "DarkGold": "#C27C0E",
    "Orange": "#E67E22",
    "DarkOrange": "#A84300",
    "Red": "#ED4245",
    "DarkRed": "#992D22",
    "Grey": "#95A5A6",
    "DarkGrey": "#979C9F",
    "DarkerGrey": "#7F8C8D",
    "LightGrey": "#BCC0C0",
    "Navy": "#34495E",
    "DarkNavy": "#2C3E50",
    "Yellow": "#FFFF00"
  };

  return colors[col] ? colors[col] : col;
}

const sendPanelDashboard = (client, channelToSend, category) => {
  let separatedPanel = category.length >= 1 && !category.includes("general");
  const listOfCategories = client.categories;

  if(category.length == 0)
    category = ["general"];

  let findCategory = [];
  for(const arg of category) {
    findCategory.push(listOfCategories.map((c) => {
      return ticketCategoryById(c, arg);
    }).filter(Boolean)?.[0]);
  }

  console.log('typeeee', config.tickets.panel_type)
  console.log('find cateee', findCategory)


  const chunks = [];
  let componentList = [],
    buttonList = [];
  if(client.config.tickets.panel_type == "BUTTONS") {
    for (let i = 0; i < findCategory.length; i += config.tickets.panel_buttons_line) {
      const chunk = findCategory.slice(i, i + config.tickets.panel_buttons_line);
      chunks.push(chunk);
    }

    for (let i = 0; i < chunks.length; i++) {
      buttonList.push(
        chunks[i].map((x) => {
          return new Discord.ButtonBuilder()
            .setLabel(separatedPanel == true ? `${x.name}` : client.language.buttons.create)
            .setEmoji(separatedPanel == true ? `${x.emoji || {}}` : config.emojis.create || {})
            .setStyle(separatedPanel == true ? Discord.ButtonStyle[x.button_color] : Discord.ButtonStyle.Primary)
            .setCustomId(separatedPanel == true ? `createTicket_${x.id}` : 'createTicket');
        })
      );
    }
  
    buttonList.forEach((b) => {
      componentList.push(new Discord.ActionRowBuilder().addComponents(b.map((x) => x)));
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
    client.categories.forEach(c => {
      options.push({
        label: c.name,
        value: c.id, 
        emoji: c.emoji || {},
        description: c.placeholder != "" ? c.placeholder : ""
      });
    });
  }

  let sMenu = new Discord.StringSelectMenuBuilder()
    .setCustomId("noSelection_panel")
    .setPlaceholder(config.tickets.select_placeholder)
    .addOptions(options);

  let row = new Discord.ActionRowBuilder()
    .addComponents(sMenu);

  let embed = new Discord.EmbedBuilder();
  if(findCategory.length >= 1 && separatedPanel == true) {
    embed.setTitle(findCategory[0].panel.title || null)
      .setDescription(findCategory[0].panel.description || null)
      .setImage(findCategory[0].panel.image || null)
      .setThumbnail(findCategory[0].panel.thumbnail || null)
      .setColor(`${findCategory[0].panel.color}`);
  } else {
    embed.setTitle(client.embeds.panel_title)
      .setDescription(client.embeds.panel_message)
      .setColor(client.embeds.general_color);

    if(client.embeds.panel.image.enabled == true && client.embeds.panel.image.url != "") embed.setImage(client.embeds.panel.image.url);
    if(client.embeds.panel.thumbnail.enabled == true && client.embeds.panel.thumbnail.url != "") embed.setThumbnail(client.embeds.panel.thumbnail.url);
  }

  if(client.embeds.panel.footer) embed.setFooter({ text: client.embeds.panel.footer, iconURL: client.user.displayAvatarURL() }).setTimestamp();

  const panelChannel = client.channels.cache.get(channelToSend);
  if(panelChannel) panelChannel.send({ embeds: [embed], components: config.tickets.panel_type == "SELECT_MENU" ? [row] : componentList });
}

const ticketCategoryById = (category, toSearch) => {
  const subSearch = category.subcategories?.find((sc) => sc.id.toLowerCase() == toSearch.toLowerCase());
  if(category.id.toLowerCase() == toSearch.toLowerCase())
    return category;
  else if(subSearch)
    return subSearch;
}

const getPayPalToken = async (clientId, clientSecret) => {
  try {
    const response = await fetch("https://api.paypal.com/v1/oauth2/token", {
      method: 'POST',
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: `grant_type=client_credentials`,
    });

    const data = await response.json();

    if (response.status == 200) {
      const accessToken = data.access_token;
      return accessToken;
    } else {
      console.error(data);
    }
  } catch (error) {
    console.error(error);
  }
};

const findTicketParent = (guild, category, fallback = []) => {
  let mainCat = findChannel(guild, category);
  const findFallback = fallback.find((f) => findChannel(guild, f)?.children?.cache?.size < 50);
  if(mainCat && mainCat?.children?.cache?.size < 8)
    return mainCat;
  else if(findFallback) 
    return findFallback;
  else return mainCat;
}

module.exports = {
  formatTime,
  capitalizeFirstLetter,
  commandsList,
  pushReview,
  generateId,
  updateStats,
  sendError,
  findChannel,
  usage,
  findRole,
  channelRoleCheck,
  hasRole,
  ticketUsername,
  sendWarn,
  filesCheck,
  downloadProduct,
  isTicket,
  hasPermissions,
  updateSuggestionEmbed,
  generateTranscript,
  ticketPlaceholders,
  canEditName,
  databaseChecks,
  commissionAccess,
  priceWithTax,
  isUnavailable,
  dashboardFormat,
  serverLogs,
  colorFormatConvert,
  dashboardLogs,
  sendPanelDashboard,
  ticketCategoryById,
  getPayPalToken,
  findTicketParent
}