const Discord = require("discord.js");
const fetch = require("node-fetch");

const chatAskQuestions = async(client, member, channel, questionsList, ticketCategory = {}) => {
  let config = client.config;
  if(questionsList.length == 0) return;
  let answersList = new Map(), attachmentsList = new Map();
  const filter = msg => msg.author.id === member.id;

  const collector = channel.createMessageCollector({ filter, idle: client.config.tickets.question_idle * 1000, max: questionsList.length });
  let questionNumber = 0;

  await client.database.ticketsData().set(`${channel.id}.listOfQuestions`, {
    list: questionsList,
    ticketCategory
  });

  const cancelAsk = new Discord.ActionRowBuilder()
    .addComponents(
      new Discord.ButtonBuilder().setCustomId("cancel_ask")
        .setEmoji(config.emojis.stop)
        .setStyle(Discord.ButtonStyle.Danger)
    );

  let questionEmbed = new Discord.EmbedBuilder()
    .setTitle(`${questionsList[questionNumber].name}`)
    .setDescription(`${questionsList[questionNumber].question}`)
    .setFooter({ text: member.user.username, iconURL: member.user.displayAvatarURL({ dynamic: true }) })
    .setTimestamp()
    .setColor(client.embeds.general_color);
    
  let msg = await channel.send({ embeds: [questionEmbed], components: client.config.general.cancel_ask == true ? [cancelAsk] : [] });
    
  if(client.config.general.cancel_ask == true) {
    const awaitFilter = (i) => i.customId == "cancel_ask" && i.user.id == member.id;
    
    msg.awaitMessageComponent({ awaitFilter }).then(async (i) => {
      await i.deferUpdate();
      await msg.delete();
      collector.stop();
    }).catch((e) => {});
  }

  let content = "";
  collector.on('collect', async(m) => {
    let content = m.content;

    if(m.attachments.size > 0) {
      let attachList = [];
      
      for(const att of m.attachments) {
        let newAttachment = new Discord.AttachmentBuilder(att[1].url, { name: att[1].name, description: questionsList[questionNumber].name })
        attachList.push(newAttachment);
      }
      
      attachmentsList.set(questionsList[questionNumber].name, attachList);
      if(m.content.length == 0) content = "[CONTENT_IS_ATTACHMENT]";
    }

    answersList.set(questionsList[questionNumber].name, `${content}`);
    questionNumber++;
    m.delete();
    if(questionNumber < questionsList.length) {
      questionEmbed.setTitle(questionsList[questionNumber].name);
      questionEmbed.setDescription(questionsList[questionNumber].question);
      await msg.edit({ embeds: [questionEmbed], components: client.config.general.cancel_ask == true ? [cancelAsk] : [] });
    } else if(questionNumber == questionsList.length) {
      finalList = new Map(answersList)
      await msg.delete();

      let answersArray = [...answersList.values()];
      let answersEmbeds = [];
      let charLimit = 0;
      let qAnswers = new Discord.EmbedBuilder()
        .setTitle(client.embeds.service.new_commission.title)
        .setColor(client.embeds.service.new_commission.color);

      const listOfAnswers = await client.database.ticketsData().get(`${channel.id}.listOfAnswers`) || [];
      for(let i = 0; i < answersArray.length; i++) {
        if(qAnswers.fields?.length >= 25 || charLimit >= 5000) {
          answersEmbeds.push(qAnswers);
          qAnswers = new Discord.EmbedBuilder()
            .setTitle(client.embeds.service.new_commission.title)
            .setColor(client.embeds.service.new_commission.color);
          charLimit = 0;
        }

        if(answersArray[i].length <= 1024) {
          qAnswers.addFields([{ name: questionsList[i].name, value: answersArray[i] }]);
          charLimit += answersArray[i].length;
        } else {
          let maxFieldLength = 1024;
          const regexPattern = new RegExp(`.{1,${maxFieldLength}}|.{1,${maxFieldLength}}$`, 'g');
          const chunks = answersArray[i].match(regexPattern);

          for(let j = 0; j < chunks.length; j++) {
            if(qAnswers.fields?.length >= 25 || charLimit >= 5000) {
              answersEmbeds.push(qAnswers);
    
              qAnswers = new Discord.EmbedBuilder()
                .setTitle(client.embeds.service.new_commission.title)
                .setColor(client.embeds.service.new_commission.color);
              charLimit = 0;
            }

            qAnswers.addFields([{ name: questionsList[i].name + ` (${j + 1})`, value: chunks[j] }]);
            charLimit += chunks[j].length;
          }
        }

        listOfAnswers.push({
          questionName: questionsList[i].name,
          question: questionsList[i].question,
          answer: answersArray[i]
        });
      }

      answersEmbeds.push(qAnswers);

      await client.database.ticketsData().set(`${channel.id}.listOfAnswers`, listOfAnswers);

      await channel.threads.create({
        name: client.language.ticket.answers_thread_name,
        autoArchiveDuration: Discord.ThreadAutoArchiveDuration.OneWeek
      }).then(async(tm) => {
        await tm.send({ content: client.language.ticket.answers_sending }).then((m) => setTimeout(async() => await m.delete(), 10000));
        for(let i = 0; i < answersArray.length; i++) {
          const answerToQuestion = answersArray[i];

          if(answerToQuestion != "[CONTENT_IS_ATTACHMENT]") {
            if(answerToQuestion.length >= 1950) {
              let maxQuestionLength = 1950;
              const regexPattern = new RegExp(`.{1,${maxQuestionLength}}|.{1,${maxQuestionLength}}$`, 'g');
              const chunks = answerToQuestion.match(regexPattern);

              for(let j = 0; j < chunks.length; j++) {
                await tm.send({ content: client.config.tickets.question_answer_format
                  .replace("<name>", questionsList[i].name + ` (${j + 1})`)
                  .replace("<question>", questionsList[i].question + ` (${j + 1})`)
                  .replace("<answer>", chunks[j]) });
              }
            } else {
              await tm.send({ content: client.config.tickets.question_answer_format
                .replace("<name>", questionsList[i].name)
                .replace("<question>", questionsList[i].question)
                .replace("<answer>", answerToQuestion) });
            }
          } else {
            await tm.send({ content: client.config.tickets.question_answer_format
              .replace("<name>", questionsList[i].name)
              .replace("<question>", questionsList[i].question)
              .replace("<answer>", "Attachment") });
          }

          let answerAttachments = attachmentsList.get(questionsList[i].name);
          if(answerAttachments) {
            await tm.send({ files: answerAttachments });
          }
        }
      });

      if(config.general.send_commissions == true && config.channels.commissions != "" && ticketCategory.type == "COMMISSION") {
        if(client.embeds.service.new_commission.description) qAnswers.setDescription(client.embeds.service.new_commission.description.replace("<user>", member.user));
        if(client.embeds.service.new_commission.thumbnail == true) qAnswers.setThumbnail(member.user.displayAvatarURL({ dynamic: true }));
        if(client.embeds.service.new_commission.footer == true) qAnswers.setFooter({ text: member.user.username, iconURL: member.user.displayAvatarURL({ dynamic: true }) });

        let commChannel = client.utils.findChannel(channel.guild, config.channels.commissions);

        const commRow = new Discord.ActionRowBuilder()
          .addComponents(
            new Discord.ButtonBuilder()
              .setStyle(Discord.ButtonStyle.Success)
              .setCustomId(`commission_${channel.id}`)
              .setLabel(client.language.buttons.send_quote)
              .setEmoji(config.emojis.send_quote || {})
          )
        
        if(config.general.buttons.message_client == true) commRow.addComponents(
          new Discord.ButtonBuilder()
            .setStyle(Discord.ButtonStyle.Secondary)
            .setCustomId(`commissionMessage_${channel.id}`)
            .setLabel(client.language.buttons.message_client)
            .setEmoji(config.emojis.msg_commission || {})
        )

        if(ticketCategory && ticketCategory.commission) {
          let categoryCommCh = client.utils.findChannel(channel.guild, ticketCategory.commission.channel);
          let categoryCommRoles = ticketCategory.commission.roles.map((x) => {
            let findRole = client.utils.findRole(channel.guild, x);
            if(findRole) return findRole;
          });

          if(categoryCommCh) {
            await categoryCommCh.send({ content: categoryCommRoles.length > 0 ? `${categoryCommRoles.join(" ")}` : '', embeds: answersEmbeds, components: [commRow] }).then(async(m) => {
              const commission = await client.database.ticketsData().get(`${channel.id}.commission`);
              commission.commMessageId = m.id;
              commission.commChannelId = m.channel.id;
              
              await m.startThread({ name: client.language.service.commission.commission_thread.replace("<id>", commission.id) }).then(async(thread) => {
                commission.commThreadId = thread.id;
                for(const [attKey, attValue] of attachmentsList) {
                  await thread.send({ content: client.config.tickets.question_answer_format
                    .replace("<name>", attKey)
                    .replace("<question>", attKey)
                    .replace("<answer>", "Attachment"), files: attValue });
                }
              });
              await client.database.ticketsData().set(`${channel.id}.commission`, commission);
            });
          } else {
            await commChannel.send({ content: categoryCommRoles.length > 0 ? `${categoryCommRoles.join(" ")}` : '', embeds: answersEmbeds, components: [commRow] }).then(async(m) => {
              const commission = await client.database.ticketsData().get(`${channel.id}.commission`);
              commission.commMessageId = m.id;
              commission.commChannelId = m.channel.id;
              
              await m.startThread({ name: client.language.service.commission.commission_thread.replace("<id>", commission.id) }).then(async(thread) => {
                commission.commThreadId = thread.id;
                for(const [attKey, attValue] of attachmentsList) {
                  await thread.send({ content: client.config.tickets.question_answer_format
                    .replace("<name>", attKey)
                    .replace("<question>", attKey)
                    .replace("<answer>", "Attachment"), files: attValue });
                }
              });
              await client.database.ticketsData().set(`${channel.id}.commission`, commission);
            });
          }
        } else {
          await commChannel.send({ embeds: answersEmbeds, components: [commRow] }).then(async(m) => {
            const commission = await client.database.ticketsData().get(`${channel.id}.commission`);
            commission.commMessageId = m.id;
            commission.commChannelId = m.channel.id;
            
            await m.startThread({ name: client.language.service.commission.commission_thread.replace("<id>", commission.id) }).then(async(thread) => {
              commission.commThreadId = thread.id;
              for(const [attKey, attValue] of attachmentsList) {
                await thread.send({ content: client.config.tickets.question_answer_format
                  .replace("<name>", attKey)
                  .replace("<question>", attKey)
                  .replace("<answer>", "Attachment"), files: attValue });
              }
            });
            await client.database.ticketsData().set(`${channel.id}.commission`, commission);
          });
        }
      }

      collector.stop();
    }
  });

  collector.on('end', async (collected, reason) => {
    if(reason.toLowerCase() == "idle") {
      let idleEmbed = new Discord.EmbedBuilder()
        .setDescription(client.language.ticket.question_idle)
        .setColor(client.embeds.general_color);
        
      channel.send({ embeds: [idleEmbed] });
    }
  });
}

module.exports = {
  chatAskQuestions
}