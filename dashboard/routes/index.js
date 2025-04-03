const express = require("express");
const router = express.Router();
const fetch = require("node-fetch");
const FormData = require("form-data");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
const yaml = require("yaml");
const { authMiddleware } = require("../middlewares/auth.js");
const { Collection } = require("discord.js");

const standardResponse = (err, html, res) => {
  if (err) {
    console.log(err);
    return res.status(500).render(`dashboard.ejs`, { page : '500', error: err }, (err, html) => standardResponse(null, html, res));
  } else {
    return res.status(200).send(html);
  }
}

const listOfTranscripts = () => {
  const transcripts = fs.readdirSync(`./transcripts`).filter((file) => file.endsWith('.html'))
    .map((file) => file.split("-")[1].replace(".html", "")).sort((a, b) => a - b);

  return transcripts;
}

const handleSorting = async(data, db, type) => {
	if(!type || type == ' ') { 
		return data;
	} 
	else {
		let dbData = await Promise.all(
			data.map(async (tId) => {
				let transcriptInfo = await db.transcriptsData().get(tId);
				if(transcriptInfo) transcriptInfo["id"] = tId;
				return transcriptInfo;
			})
		);

		if(type == "id_asc") {
			return dbData.slice().filter(Boolean).sort((a, b) => a.id.localeCompare(b.id)).map((tr) => tr.id);
		} else if(type == "id_desc") {
			return dbData.slice().filter(Boolean).sort((a, b) => b.id.localeCompare(a.id)).map((tr) => tr.id);
		} else if(type == "date_asc") {
			return dbData.slice().filter(Boolean).sort((a, b) => new Date(a.date) - new Date(b.date)).map((tr) => tr.id);
		} else if(type == "date_desc") {
			return dbData.slice().filter(Boolean).sort((a, b) => new Date(b.date) - new Date(a.date)).map((tr) => tr.id);
		}
	}
}

router.get("/", async (req, res) => {
	const tokenCookie = req.cookies["token"];
  const decoded = await jwt.decode(tokenCookie);

  const user = req.client.users.cache.get(decoded);

	if(user) return res.redirect("/dashboard");
	await res.render("index", {
		bot: req.client,
		guild: req.client,
	})
});

router.get("/403", async(req, res) => {
	await res.render("403", {
		bot: req.client,
		guild: req.client
	})
});

router.get("/404", async(req, res) => {
	await res.render("404", {
		bot: req.client,
		guild: req.client
	})
});

router.get("/dashboard", authMiddleware, async(req, res) => {
	await res.render("dashboard", {
		bot: req.client,
		user: req.user,
		guild: req.guild,
	}, (err, html) => standardResponse(err, html, res));
});

router.get("/ticketing", authMiddleware, async(req, res) => {
	if(req.client.config.server.dashboard.modules.ticketing == false)
		return res.redirect("/dashboard");

	const categoriesList = req.client.categories;
	const db = req.client.database;
	let { categoryId, isNew, editingSub, subId, isNewSub, sortBy } = req.query;
	if(!categoryId) categoryId = 0;
	let transcriptsResult = req.query.transcriptsResult ? decodeURIComponent(req.query.transcriptsResult).split(',') : undefined;

	let category = categoriesList[categoryId];
	let categoryRoles;

	if(!category) 
		category = categoriesList[0];

	if(editingSub && subId)
		category = categoriesList[categoryId]?.subcategories?.[subId] || categoriesList[0];

	let duplicate;
	if(isNew == 1) {
		duplicate = JSON.parse(JSON.stringify(category));
		duplicate["id"] = `copy_${duplicate["id"]}`;
		duplicate["name"] = `Copy of ${duplicate["name"]}`;
	}

	if(category && category.roles) 
		categoryRoles = category.roles.map((r) => req.client.utils.findRole(req.guild, r)?.id).filter(Boolean);

	let transcriptsList = transcriptsResult || listOfTranscripts();
	let sortTranscripts = await handleSorting(transcriptsList, db, sortBy || null);

	await res.render("ticketing", {
		bot: req.client,
		user: req.user,
		guild: req.guild,
		transcripts: sortTranscripts,
		category: isNew == 1 ? duplicate : category,
		parentCategory: categoriesList[categoryId]?.id,
		subId: category.id,
		categoryRoles: categoryRoles || [],
		isSub: isNewSub == 1 || editingSub ? true : false,
		inCloned: isNew == 1 ? true : false
	}, (err, html) => standardResponse(err, html, res));
});

router.post("/ticketing/panel", authMiddleware, async(req, res) => {
	if(req.client.config.server.dashboard.modules.ticketing == false)
		return res.redirect("/dashboard");
	
	const { channel, category } = JSON.parse(req.body.panelData);
	const client = req.client;

	client.utils.sendPanelDashboard(client, channel, category);

	res.status(200).json({ code: 200 });
});

router.get("/ticketing/:id", authMiddleware, async(req, res) => {
	if(req.client.config.server.dashboard.modules.ticketing == false)
		return res.redirect("/dashboard");
	
	const client = req.client;
	const { id } = req.params;
	const channel = client.channels.cache.get(id);

	let messageCollection = new Collection();
  let channelMessages = await channel.messages.fetch({ limit: 100 });

	messageCollection = messageCollection.concat(channelMessages);

  while(channelMessages.size === 100) {
    let lastMessageId = channelMessages.lastKey();
    channelMessages = await channel.messages.fetch({ limit: 100, before: lastMessageId });
    if(channelMessages) messageCollection = messageCollection.concat(channelMessages);
  }

  let msgs = [...messageCollection.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp)

	let ticketView = await client.utils.generateTranscript(client, channel, msgs, "-1", false);

	ticketView += `
		<head>
			<title>QuickLand Tickets - View Ticket</title>
		</head>
	`;

	res.send(ticketView);
});

router.post("/ticketing/:id/close", authMiddleware, async(req, res) => {
	if(req.client.config.server.dashboard.modules.ticketing == false)
		return res.redirect("/dashboard");
	
	const client = req.client;
	const { id } = req.params;
	const ticketData = await client.database.ticketsData().get(`${id}.ticketData`);

	const channel = client.channels.cache.get(id);

	let messageCollection = new Collection();
  let channelMessages = await channel.messages.fetch({ limit: 100 });

	messageCollection = messageCollection.concat(channelMessages);

  while(channelMessages.size === 100) {
    let lastMessageId = channelMessages.lastKey();
    channelMessages = await channel.messages.fetch({ limit: 100, before: lastMessageId });
    if(channelMessages) messageCollection = messageCollection.concat(channelMessages);
  }
  
  let msgs = [...messageCollection.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp)

	if(client.config.tickets.transcripts == true && client.config.tickets.transcript_type == "HTML") {
		await client.utils.generateTranscript(client, channel, msgs, ticketData?.id).then(async() => {
			await channel.delete();
		});
	} else {
		await channel.delete();
	}

	if (client.config.server.selfhost.enabled == true) {
		let transcriptCode = (Math.random() * 466567).toString(36).slice(-7).replace(".", "");
		let randomIdCase = Math.floor(Math.random() * 1000);
		await client.database.transcriptsData().set(`${ticketData?.id || randomIdCase}`, {
			code: transcriptCode,
			author: ticketData?.owner,
			date: new Date()
		});
	}

	await client.utils.dashboardLogs(client, {
		date: new Date().toLocaleString("en-GB"),
		author: `${req.user.username}`,
		user: null,
		channel_id: `${channel.id}`,
		channel_name: `${channel.name}`,
		ticketId: ticketData.id,
		message: `dash_ticket_del`
	});

	res.status(200).redirect("/ticketing");
});

router.post("/ticketing/transcripts/search", authMiddleware, async(req, res) => {
	if(req.client.config.server.dashboard.modules.ticketing == false)
		return res.redirect("/dashboard");
	
	const { transcript_data } = req.body;
	const client = req.client;

	if(transcript_data == '' || !transcript_data)
		return res.status(200).redirect("/ticketing");

	let resultsData = [];
	try {
    const files = await fs.promises.readdir("./transcripts");

    const readPromises = files.map(async (file) => {
      if (path.extname(file).toLowerCase() == ".html") {
        const filePath = path.join("./transcripts", file);

        const content = await fs.promises.readFile(filePath, 'utf8');

        if (content.includes(`transcript-user-id="${transcript_data}"`)
					|| content.includes(`transcript-user-username="${transcript_data}"`)
					|| transcript_data == file.split("-")[1].replace(".html", "")
					|| content.includes(transcript_data)) {
          resultsData.push(file.split("-")[1].replace(".html", ""));
        }
      }
    });

    await Promise.all(readPromises);

    const redirectUrl = '/ticketing?transcriptsResult=' + encodeURIComponent(resultsData.join(","));

    res.status(200).redirect(redirectUrl);
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

router.post("/ticketing/transcripts/sort", authMiddleware, async(req, res) => {
	if(req.client.config.server.dashboard.modules.ticketing == false)
		return res.redirect("/dashboard");
	
	const { sort_by, curr_params } = req.body;
	const client = req.client;

	if(!sort_by || sort_by == '' || sort_by == ' ')
		return res.status(200).redirect("/ticketing");

	let redirectUrl = `/ticketing?sortBy=${sort_by}${curr_params ? `&${curr_params}` : ''}`;
	
	res.status(200).json({ code: 200, redirectQuery: redirectUrl });
});

router.get("/settings", authMiddleware, async(req, res) => {
	if(req.client.config.server.dashboard.modules.settings.enabled == false)
		return res.redirect("/dashboard");

	const commandList = Object.keys(req.client.cmdConfig);
	await res.render("settings", {
		bot: req.client,
		user: req.user,
		guild: req.guild,
		commands: commandList.sort(),
	}, (err, html) => standardResponse(err, html, res));
});

router.patch("/settings/config/:option", authMiddleware, async(req, res) => {
	if(req.client.config.server.dashboard.modules.settings.enabled == false)
		return res.redirect("/dashboard");

	const { option } = req.params;
	let { value, section, boolean } = JSON.parse(req.body.configData);
	const client = req.client;

	let path = `${section}.${option}`;
	if(!section) path = `${option}`;

	await client.utils.dashboardLogs(client, {
    date: new Date().toLocaleString("en-GB"),
    author_id: req.user.id,
    author: req.user.username,
    user_id: null,
    user: null,
    channel_id: null,
    channel_name: null,
    option: `${path}`,
		value: null,
    message: `dash_edit_cfg`
  });

	if(typeof path.split(".").reduce((o, key) => o && o[key] ? o[key] : null, client.config) == "number")
		value = Number(value);

	let doc = yaml.parseDocument(fs.readFileSync('./configs/config.yml', 'utf8'));
	if(value) {
		if(path.split(".").reduce((o, key) => o && o[key] ? o[key] : null, client.config) == value)
			return res.status(200).json({ code: 444 });

		doc.setIn(`${path}`.split("."), value);
	} else if(!value && boolean == true) {
		doc.setIn(`${path}`.split("."), !path.split(".").reduce((o, key) => o && o[key] ? o[key] : null, client.config));
	} else {
		if(path.split(".").reduce((o, key) => o && o[key] ? o[key] : null, client.config) == "")
			return res.status(200).json({ code: 444 });

		doc.setIn(`${path}`.split("."), "");
	}

	const documentToString = doc.toString({ lineWidth: 100000, doubleQuotedAsJSON: true, singleQuote: false, defaultStringType: "QUOTE_DOUBLE", defaultKeyType: "PLAIN" })
		.replaceAll(/(\[ )/gm, "[")
		.replaceAll(/( ])$/gm, "]");
	
	fs.writeFileSync('./configs/config.yml', documentToString, 'utf-8');
	req.client.config = doc.toJSON();

	res.status(200).json({ code: 200 });
});

router.patch("/settings/embeds", authMiddleware, async(req, res) => {
	if(req.client.config.server.dashboard.modules.settings.enabled == false)
		return res.redirect("/dashboard");

	let { value, section, boolean } = JSON.parse(req.body.embedsData);
	const client = req.client;

	let path = `${section}`;

	await client.utils.dashboardLogs(client, {
    date: new Date().toLocaleString("en-GB"),
    author_id: req.user.id,
    author: req.user.username,
    user_id: null,
    user: null,
    channel_id: null,
    channel_name: null,
    option: `${path}`,
		value: null,
    message: `dash_edit_cfg`
  });

	if(typeof path.split(".").reduce((o, key) => o && o[key] ? o[key] : null, client.embeds) == "number")
		value = Number(value);

	let doc = yaml.parseDocument(fs.readFileSync('./configs/embeds.yml', 'utf8'));
	if(value && value != "") {
		if(path.split(".").reduce((o, key) => o && o[key] ? o[key] : null, client.embeds) == value)
			return res.status(200).json({ code: 444 });

		doc.setIn(`${path}`.split("."), value);
	} else if(!value && boolean == true) {
		doc.setIn(`${path}`.split("."), !path.split(".").reduce((o, key) => o && o[key] ? o[key] : null, client.embeds));
	} else {
		if(path.split(".").reduce((o, key) => o && o[key] ? o[key] : null, client.embeds) == null)
			return res.status(200).json({ code: 444 });

		doc.setIn(`${path}`.split("."), "");
	}

	const documentToString = doc.toString({ lineWidth: 100000, doubleQuotedAsJSON: true, singleQuote: false, defaultStringType: "QUOTE_DOUBLE", defaultKeyType: "PLAIN" })
		.replaceAll(/(\[ )/gm, "[")
		.replaceAll(/( ])$/gm, "]");

	fs.writeFileSync('./configs/embeds.yml', documentToString, 'utf-8');
	req.client.embeds = doc.toJSON();

	res.status(200).json({ code: 200 });
});

router.patch("/settings/config/:category/category", authMiddleware, async(req, res) => {
	if(req.client.config.server.dashboard.modules.settings.enabled == false)
		return res.redirect("/dashboard");

	const { category } = req.params;
	const data = req.body;
	const client = req.client;

	let doc = yaml.parseDocument(fs.readFileSync('./configs/categories.yml', 'utf8'));

	const categoryData = JSON.parse(data.categoryData);
	const subcategoryId = data.subCategory;
	const parentCategory = data.parentCategory;
	const keys = Object.keys(categoryData);

	if(!parentCategory) {
		const currentCategory = client.categories.find((x) => x.id == category);
		const currentIndex = client.categories.indexOf(currentCategory);

		if(currentIndex == -1) {
			for(const key of keys) {
				const keyValue = categoryData[key];
				doc.setIn(`${client.categories.length}.${key}`.split("."), keyValue);
			}
		} else {
			 for(const key of keys) {
				const keyValue = categoryData[key];
				doc.setIn(`${currentIndex}.${key}`.split("."), keyValue);
			}
		}
	} else {
		const currentCategory = client.categories.find((x) => x.id == parentCategory);
		const currentIndex = client.categories.indexOf(currentCategory);

		const currentSubCategory = currentCategory.subcategories.find((x) => x.id == category);
		const currentSubIndex = currentCategory.subcategories.indexOf(currentSubCategory);

		if(currentSubIndex == -1) {
			for(const key of keys) {
				const keyValue = categoryData[key];
				doc.setIn(`${currentIndex}.subcategories.${currentCategory.subcategories.length}.${key}`.split("."), keyValue);
			}
		} else {
			 for(const key of keys) {
				const keyValue = categoryData[key];
				doc.setIn(`${currentIndex}.subcategories.${subcategoryId}.${key}`.split("."), keyValue);
			}
		}
	}
	
	const documentToString = doc.toString({ lineWidth: 100000, doubleQuotedAsJSON: true, singleQuote: false, defaultStringType: "QUOTE_DOUBLE", defaultKeyType: "PLAIN" })
		.replaceAll(/(\[ )/gm, "[")
		.replaceAll(/( ])$/gm, "]");
	
	fs.writeFileSync('./configs/categories.yml', documentToString, 'utf-8');
	req.client.categories = doc.toJSON();

	res.status(200).json({ code: 200 });
});

router.delete("/settings/config/:category/category", async(req, res) => {
	if(req.client.config.server.dashboard.modules.settings.enabled == false)
		return res.redirect("/dashboard");
	
	const { category } = req.params;
	const data = req.body;
	const subcategoryId = data.subCategory;
	const parentCategory = data.parentCategory;
	const client = req.client;

	const doc = yaml.parseDocument(fs.readFileSync('./configs/categories.yml', 'utf8'));
	
	if(!parentCategory) {
		const catIndex = client.categories.findIndex((i) => i.id == category);
		doc.deleteIn(`${catIndex}`.split("."));
	} else {
		const catIndex = client.categories.findIndex((i) => i.id == parentCategory);
		doc.deleteIn(`${catIndex}.subcategories.${subcategoryId}`.split("."));
	}

	const documentToString = doc.toString({ lineWidth: 100000, doubleQuotedAsJSON: true, singleQuote: false, defaultStringType: "QUOTE_DOUBLE", defaultKeyType: "PLAIN" })
		.replaceAll(/(\[ )/gm, "[")
		.replaceAll(/( ])$/gm, "]");
	
	fs.writeFileSync('./configs/categories.yml', documentToString, 'utf-8');
	req.client.categories = doc.toJSON();

	res.status(200).json({ code: 200 });
});

router.patch("/settings/commands/:name", authMiddleware, async(req, res) => {
	if(req.client.config.server.dashboard.modules.settings.enabled == false)
		return res.redirect("/dashboard");

	const { name } = req.params;
	const client = req.client;

	await client.utils.dashboardLogs(client, {
		date: new Date().toLocaleString("en-GB"),
		author_id: req.user.id,
		author: `${req.user.username}`,
		user_id: req.user.id,
		user: req.user.username,
		channel_id: null,
		channel_name: null,
		ticketId: null,
    option: `${name}`,
    value: client.cmdConfig[name].enabled ? "off" : "on",
		message: `dash_toggle_cmd`
	});

	let doc = yaml.parseDocument(fs.readFileSync('./configs/commands.yml', 'utf8'));
	doc.setIn(`${name}.enabled`.split("."), !client.cmdConfig[name].enabled);

	const documentToString = doc.toString({ lineWidth: 100000, doubleQuotedAsJSON: true })
		.replaceAll(/(\[ )/gm, "[")
		.replaceAll(/( ])$/gm, "]");
	
	fs.writeFileSync('./configs/commands.yml', documentToString, 'utf-8');
	req.client.cmdConfig = doc.toJSON();

	res.status(200).json({ code: 200 });
});

router.post("/settings/balance/reset", authMiddleware, async(req, res) => {
	if(req.client.config.server.dashboard.modules.settings.enabled == false)
		return res.redirect("/dashboard");

	const data = req.body;
	const client = req.client;

	const balance = await client.database.usersData().get(`${data.user}.balance`);
	if(balance)
		await client.database.usersData().delete(`${data.user}.balance`);
	
	res.status(200).json({ code: 200 });
});

router.post("/settings/balance", authMiddleware, async(req, res) => {
	if(req.client.config.server.dashboard.modules.settings.enabled == false)
		return res.redirect("/dashboard");

	const data = req.body;
	const client = req.client;

	const user = client.users.cache.get(Object.keys(data)[0]);

	await client.database.usersData().set(`${Object.keys(data)[0]}.balance`, Number(Object.values(data)[0]));

	await client.utils.dashboardLogs(client, {
		date: new Date().toLocaleString("en-GB"),
		author_id: req.user.id,
		author: `${req.user.username}`,
		user_id: user.id,
		user: user.username,
		channel_id: null,
		channel_name: null,
		ticketId: null,
		amount: Number(Object.values(data)[0]),
		message: `dash_balance_change`
	});

	res.status(200).redirect("/settings")
});

router.post("/settings/users/:option", authMiddleware, async(req, res) => {
	if(req.client.config.server.dashboard.modules.settings.enabled == false)
		return res.redirect("/dashboard");

	const data = req.body;
	const { option } = req.params;
	const userId = Object.values(data)[0];
	const client = req.client;
	const user = client.users.cache.get(userId);

	if(!user)
		return res.status(404).redirect("/settings");

	let doc = yaml.parseDocument(fs.readFileSync('./configs/config.yml', 'utf8'));
	if(client.config.server.dashboard.users[option].includes(userId)) {
		doc.setIn(`server.dashboard.users.${option}`.split("."), client.config.server.dashboard.users[option].filter((v) => v != userId));
		await client.utils.dashboardLogs(client, {
      date: new Date().toLocaleString("en-GB"),
			author_id: req.user.id,
      author: `${req.user.username}`,
			user_id: user.id,
      user: user.username,
      channel_id: null,
      channel_name: null,
      ticketId: null,
      message: `dash_removed`
    });
	} else {
		doc.addIn(`server.dashboard.users.${option}`.split("."), userId);
		await client.utils.dashboardLogs(client, {
      date: new Date().toLocaleString("en-GB"),
			author_id: req.user.id,
      author: `${req.user.username}`,
			user_id: user.id,
      user: user.username,
      channel_id: null,
      channel_name: null,
      ticketId: null,
      message: `dash_added`
    });
	}

	const documentToString = doc.toString({ lineWidth: 100000, doubleQuotedAsJSON: true })
		.replaceAll(/(\[ )/gm, "[")
		.replaceAll(/( ])$/gm, "]");

	fs.writeFileSync('./configs/config.yml', documentToString, 'utf-8');
	req.client.config = doc.toJSON();

	res.status(200).redirect("/settings");
});

router.get("/logs", authMiddleware, async(req, res) => {
	if(req.client.config.server.dashboard.modules.logs == false)
		return res.redirect("/dashboard");

	await res.render("logs", {
		bot: req.client,
		user: req.user,
		guild: req.guild,
	}, (err, html) => standardResponse(err, html, res));
});

router.get("/profile", authMiddleware, async(req, res) => {
	await res.render("profile", {
		bot: req.client,
		user: req.user,
		guild: req.guild,
	}, (err, html) => standardResponse(err, html, res));
});

router.get("/invoicing", authMiddleware, async(req, res) => {
	if(req.client.config.server.dashboard.modules.invoicing == false)
		return res.redirect("/dashboard");
	if(!req.client.config.paypal.secret || !req.client.config.paypal.client_id)
		return res.redirect("/dashboard");
	
	const filter = req.query.filter;
	const searchQuery = {
		status: ["UNPAID","PAID","SENT","MARKED_AS_PAID","CANCELLED","REFUNDED"]
	};

	const accessToken = await req.client.utils.getPayPalToken(req.client.config.paypal.client_id, req.client.config.paypal.secret);

	const invoices = new Promise((res, rej) => {
		fetch(`https://api.paypal.com/v2/invoicing/search-invoices?page=1&page_size=100&total_required=true`, {
			method: "POST",
			headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
      }
		}).then(async(resp) => {
			let data = await resp.json();
			if(data.error) {
				console.log(data.error_description)
				rej([]);
			}

			res(data?.items || []);
		})
	});

	let filterData = await invoices;

	if(filter == "1")
		filterData = filterData.filter((x) => x.status == "PAID");
	else if(filter == "2")
		filterData = filterData.filter((x) => x.status == "UNPAID");
	else if(filter == "3")
		filterData = filterData.filter((x) => x.status == "MARKED_AS_PAID");
	else if(filter == "4")
		filterData = filterData.filter((x) => x.status == "CANCELLED");

	await res.render("invoicing", {
		bot: req.client,
		user: req.user,
		guild: req.guild,
		invoices: filterData
	})
});

router.post("/invoicing/:id/cancel", authMiddleware, async(req, res) => {
	if(req.client.config.server.dashboard.modules.invoicing == false)
		return res.redirect("/dashboard");

	const { id } = req.params;
	const client = req.client;

	const options = {
		subject: `Cancelled from Dashboard by ${req.user.username}`,
		send_to_merchant: false,
		send_to_payer: false
	}

	const accessToken = await client.utils.getPayPalToken(req.client.config.paypal.client_id, req.client.config.paypal.secret);

	await fetch(`https://api.paypal.com/v2/invoicing/invoices/${id}/cancel`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"Authorization": `Bearer ${accessToken}`,
		},
		body: JSON.stringify({ subject: `Cancelled from Dashboard by ${req.user.username}`, send_to_invoicer: false, send_to_recipient: false })
	}).then(() => {
		res.status(200).json({ code: 200 });
	})
});

router.post("/profile/edit", authMiddleware, async(req, res) => {
	const client = req.client;
	const user = req.user;
	const body = req.body;

	const userData = await client.database.usersData().get(`${user.id}`) || {};
	
	let hours = userData.availableHours;
	let paypal = userData.paypal;
	let bio = userData.bio;
	let portfolio = userData.portfolio;

	if(body.hours != hours) {
		if(body.hours == "" || !body.hours) await client.database.usersData().delete(`${user.id}.availableHours`)
		else await client.database.usersData().set(`${user.id}.availableHours`, body.hours)
	} 
	if(body.paypal != paypal) {
		if(body.paypal == "" || !body.paypal) await client.database.usersData().delete(`${user.id}.paypal`)
		else await client.database.usersData().set(`${user.id}.paypal`, body.paypal)
	} 
	if(body.bio != bio) {
		if(body.bio == "" || !body.bio) await client.database.usersData().delete(`${user.id}.bio`)
		else await client.database.usersData().set(`${user.id}.bio`, body.bio)
	} 
	if(body.portfolio != portfolio) {
		if(body.portfolio == "" || !body.portfolio) await client.database.usersData().delete(`${user.id}.portfolio`)
		else {
			if(/(https?:\/\/)?([^\s]+)?[^\s]+\.[^\s]+/.test(body.portfolio) == true) {
				await client.database.usersData().set(`${user.id}.portfolio`, body.portfolio)
			}
		}
	}

	res.status(200).json({ code: 200 });
})

router.get("/logout", authMiddleware, async(req, res) => {
	const client = req.client;
	await client.utils.dashboardLogs(client, {
		date: new Date().toLocaleString("en-GB"),
		author_id: req.user.id,
		author: `${req.user.username}`,
		user_id: null,
		user: null,
		channel_id: null,
		channel_name: null,
		ticketId: null,
		message: `dash_logout`
	});
	
  res.clearCookie("token");
  res.redirect("/");
});

router.get("/callback", async(req, res) => {
  if (req.user) return res.redirect("/dashboard");
  
  const accessCode = req.query.code;
  if (!accessCode) return res.redirect("/");

  const client = req.client;

  const data = new FormData();
  data.append("client_id", client.config.server.dashboard.client_id);
  data.append("client_secret", client.config.server.dashboard.client_secret);
  data.append("grant_type", "authorization_code");
  data.append("redirect_uri", client.config.server.url + "/callback");
  data.append("scope", "identify guilds");
  data.append("code", accessCode);
  
  let response = await fetch("https://discordapp.com/api/oauth2/token", {
    method: "POST",
    body: data
  })

  const bearerTokens = await response.json();

  response = await fetch("https://discordapp.com/api/users/@me", {
    method: "GET",
    headers: { Authorization: `Bearer ${bearerTokens.access_token}` }
  });

  let json = await response.json();
	
  const member = req.guild.members.cache.get(json.id);
	if(!member)
		return res.redirect("/403");
	
	const dashboardAccess = client.config.server.dashboard.users.access || [];
  if(member.id != req.guild.ownerId && !client.config.roles.dashboard.access.some((r) => member.roles.cache.has(r)) && !dashboardAccess.includes(json.id))
    return res.redirect("/403");

  const token = await jwt.sign(`${json.id}`, client.config.server.dashboard.jwt);

  res.cookie("token", token, {
    expires: new Date(Date.now()+2.592e+8)
  });

  req.user = client.users.cache.get(json.id);

  await client.utils.dashboardLogs(client, {
		date: new Date().toLocaleString("en-GB"),
		author_id: json.id,
		author: `${json.username}`,
		user_id: null,
		user: null,
		channel_id: null,
		channel_name: null,
		ticketId: null,
		message: `dash_login`
	});

  res.redirect("/dashboard");
});

module.exports = router;