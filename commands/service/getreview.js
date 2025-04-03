const Command = require("../../structures/Command");
const Discord = require("discord.js");

module.exports = class GetReview extends Command {
  constructor(client) {
    super(client, {
      name: "getreview",
      description: client.cmdConfig.getreview.description,
      usage: client.cmdConfig.getreview.usage,
      permissions: client.cmdConfig.getreview.permissions,
      aliases: client.cmdConfig.getreview.aliases,
      category: "service",
      enabled: client.cmdConfig.getreview.enabled,
      slash: true,
      options: [{
        name: 'user',
        type: Discord.ApplicationCommandOptionType.User,
        description: "User who's Review to get",
        required: true,
      },{
        name: 'id',
        type: Discord.ApplicationCommandOptionType.String,
        description: "ID of Review",
        required: true,
      }]
    });
  }

  async run(message, args) {
    let config = this.client.config;

    let user = message.mentions.users.first() || this.client.users.cache.get(args[0]) || message.author;
    let id = args[1];
    
    if(!id) return message.channel.send({ embeds: [this.client.utils.usage(this.client, message, this.client.cmdConfig.getreview.usage)] });
    if(id.startsWith("#"))  id = id.slice(1);
    
    let data = await this.client.database.usersData().get(`${user.id}.reviews`) || [];
    
    let find = data.find((d) => d.id.toLowerCase() == id.toLowerCase() && d.user == user.id);
    if(!find) return message.channel.send({ embeds: [this.client.embedBuilder(this.client, message.author, this.client.language.titles.error, this.client.language.service.no_review, this.client.embeds.error_color )] });
    
    let rUser = this.client.users.cache.get(find.user)?.username;
    if(rUser == undefined || rUser == null) rUser = "Unknown User";
    
    let author = this.client.users.cache.get(find.author)?.username;
    if(author == undefined || author == null) author = "Unknown Author";
    
    let rate = config.emojis.review.star.repeat(parseInt(find.rating));
    let formatDate = find.date.toLocaleString("en-GB");
    
    let embed = new Discord.EmbedBuilder()
      .setDescription(this.client.embeds.service.review_info.description.replace("<id>", find.id)
        .replace("<author>", author)
        .replace("<user>", rUser)
        .replace("<authorId>", this.client.users.cache.get(find.author))
        .replace("<userId>", this.client.users.cache.get(find.user))
        .replace("<comment>", find.comment)
        .replace("<rating>", rate)
        .replace("<date>", formatDate))
      .setColor(this.client.embeds.service.review_info.color);
      
    if(this.client.embeds.service.review_info.title) embed.setTitle(this.client.embeds.service.review_info.title);
    if(this.client.embeds.service.review_info.footer == true) embed.setFooter({ text: message.author.username, iconURL: message.author.displayAvatarURL() }).setTimestamp();
    
    message.channel.send({ embeds: [embed] });
  }
  async slashRun(interaction, args) {
    let config = this.client.config;

    let user = interaction.options.getUser("user");
    let id = interaction.options.getString("id");

    let data = await this.client.database.usersData().get(`${user.id}.reviews`) || [];
    
    let find = data.find(d => d.id == id && d.user == user.id);
    if(!find) return interaction.reply({ embeds: [this.client.embedBuilder(this.client, interaction.user, this.client.language.titles.error, this.client.language.service.no_review, this.client.embeds.error_color )] });
    
    let rUser = this.client.users.cache.get(find.user)?.username;
    if(rUser == undefined || rUser == null) rUser = "Unknown User";
    
    let author = this.client.users.cache.get(find.author)?.username;
    if(author == undefined || author == null) author = "Unknown Author";
    
    let rate = config.emojis.review.star.repeat(parseInt(find.rating));
    let formatDate = find.date.toLocaleString("en-GB");
    
    let embed = new Discord.EmbedBuilder()
      .setDescription(this.client.embeds.service.review_info.description.replace("<id>", find.id)
        .replace("<author>", author)
        .replace("<user>", rUser)
        .replace("<authorId>", this.client.users.cache.get(find.author))
        .replace("<userId>", this.client.users.cache.get(find.user))
        .replace("<comment>", find.comment)
        .replace("<rating>", rate)
        .replace("<date>", formatDate))
      .setColor(this.client.embeds.service.review_info.color);
      
    if(this.client.embeds.service.review_info.title) embed.setTitle(this.client.embeds.service.review_info.title);
    if(this.client.embeds.service.review_info.footer == true) embed.setFooter({ text: interaction.user.username, iconURL: interaction.user.displayAvatarURL() }).setTimestamp();
    
    interaction.reply({ embeds: [embed], flags: this.client.cmdConfig.getreview.ephemeral ? Discord.MessageFlags.Ephemeral : 0 });
  }
};