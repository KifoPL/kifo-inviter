const Discord = require("discord.js");
const { MessageButton, MessageActionRow } = require("discord.js");
require("dotenv")?.config();
const fs = require("fs");
const ms = require("ms");
const kifo = require("kifo");
const main = require(`./index.js`);

//client login
const client = new Discord.Client({
	partials: [`MESSAGE`, `CHANNEL`, `REACTION`],
	intents: [
		Discord.Intents.FLAGS.GUILDS,
		Discord.Intents.FLAGS.GUILD_MEMBERS,
		Discord.Intents.FLAGS.GUILD_INTEGRATIONS,
		Discord.Intents.FLAGS.GUILD_WEBHOOKS,
		Discord.Intents.FLAGS.GUILD_INVITES,
		Discord.Intents.FLAGS.GUILD_PRESENCES,
		Discord.Intents.FLAGS.GUILD_MESSAGES,
		Discord.Intents.FLAGS.DIRECT_MESSAGE_REACTIONS,
		Discord.Intents.FLAGS.GUILD_MESSAGE_TYPING,
		Discord.Intents.FLAGS.DIRECT_MESSAGES,
		Discord.Intents.FLAGS.DIRECT_MESSAGE_REACTIONS,
		Discord.Intents.FLAGS.DIRECT_MESSAGE_TYPING,
	],
});

//Owner is Discord User @KifoPL#3358 - <@289119054130839552>
async function loadowner() {
	clientapp = await client.application.fetch();
	clientapp.commands.fetch().then(() => console.log("Fetched / commands!"));
	Owner = clientapp.owner;
	console.log("Bot owner object loaded!");
}

//DATABASE CONNECTION
const mysql = require("mysql");
var dbconfig = {
	host: process.env.HOST,
	user: process.env.USER,
	password: process.env.PASSWORD,
	database: "kifo_inviter_db",
	//totally not from stack overflow, but works beautifully
	typeCast: function castField(field, useDefaultTypeCasting) {
		// We only want to cast bit fields that have a single-bit in them. If the field
		// has more than one bit, then we cannot assume it is supposed to be a Boolean.
		if (field.type === "BIT" && field.length === 1) {
			var bytes = field.buffer();

			// A Buffer in Node represents a collection of 8-bit unsigned integers.
			// Therefore, our single "bit field" comes back as the bits '0000 0001',
			// which is equivalent to the number 1.
			return bytes[0] === 1;
		}

		return useDefaultTypeCasting();
	},
};

/**
 * @example
 * GuildIdInviterId = { InviterId, GuildId, RoleId, ChannelId, Message }
 */
let autoinvites = new Map();
/**
 * @example
 * GuildIdInviterId = int
 */
let autoinvitesUses = new Map();
var con;
function dbReconnect() {
	con = mysql.createConnection(dbconfig);
	con.connect(async function (err) {
		if (err) {
			main.log(err);
			Owner?.send({ embeds: [kifo.embed(err, "Error:")] }).catch(
				() => {}
			);
			setTimeout(dbReconnect, 3000);
		}
		console.log(`Connected to ${process.env.HOST} MySQL DB!`);
		module.exports.con = con;
	});

	con.on("error", function (err) {
		main.log(err);
		Owner?.send({ embeds: [kifo.embed(err, "Error:")] }).catch(() => {});
		if (err.code === "PROTOCOL_CONNECTION_LOST") {
			dbReconnect();
		} else {
			Owner?.send({
				embeds: [kifo.embed(err, "Error BOT IS SHUT DOWN:")],
			}).catch(() => {});
			throw err;
		}
	});
}

dbReconnect();
let j = 0;
client.slash_commands = new Discord.Collection();
console.log("Loading / commands...");
const cmdFiles = fs
	.readdirSync(`./slash_commands`)
	.filter((file) => file.endsWith(".js"));
for (const file of cmdFiles) {
	const command = require(`./slash_commands/${file}`);
	client.slash_commands.set(command.name, command);
	console.log(`/ "${file.slice(0, -3)}"`);
	j++;
}
console.log(`Loaded ${j} / commands!`);
//Superior way to delay stuff using promises like a pro I am
const timer = (ms) => new Promise((res) => setTimeout(res, ms));
//timer(500).then(_ => {})

function checks(message, prefix) {
	if (!message.content.startsWith(prefix)) return false;
	if (message.guild == null) return false;
	if (
		message.member.id !== message.guild.ownerId &&
		message.member.id !== "289119054130839552"
	)
		return false;
	if (
		!message.guild?.me
			.permissionsIn(message.channel)
			.has(Discord.Permissions.FLAGS.SEND_MESSAGES)
	)
		return false;
	return true;
}
async function commands(message, prefix) {
	//If command detected, create args struct
	let args = message.content.slice(prefix.length).split(/ +/);
	let command = args.shift().toLowerCase();
	if (command == "deploy" && message.author == Owner) {
		const btnRow = new MessageActionRow().addComponents(
			new MessageButton()
				.setCustomId("deploy_guild")
				.setLabel("Test")
				.setStyle("PRIMARY"),
			new MessageButton()
				.setCustomId("deploy_global")
				.setLabel("Production")
				.setStyle("SECONDARY"),
			new MessageButton()
				.setCustomId("undeploy")
				.setLabel("DELETE ALL")
				.setStyle("DANGER")
		);
		message.channel
			.send({
				embeds: [
					kifo.embed(
						"Where would you like to deploy all `/ commands?"
					),
				],
				components: [btnRow],
			})
			.then((msg) =>
				msg
					.awaitMessageComponent({ time: 15000 })
					.then((interaction) => {
						if (interaction.customId.startsWith("deploy_")) {
							const commandFolders = fs
								.readdirSync("./slash_commands")
								.filter((file) => file.endsWith(".js"));
							console.log("Loading / commands...");
							let i = 0;
							let data = [];
							for (const cmd of commandFolders) {
								const command = require(`./slash_commands/${cmd}`);
								data.push({
									name: command.name,
									description: command.description,
									options: command.options,
									defaultPermission:
										command.defaultPermission,
								});
								console.log(`/ "${cmd.slice(0, -3)}"`);
								i++;
							}
							if (interaction.customId == "deploy_guild") {
								clientapp.commands.set(data, msg.guild.id);
							} else if (
								interaction.customId == "deploy_global"
							) {
								clientapp.commands.set(data);
							}
							console.log(`Deployed ${i} commands to test!`);

							interaction.reply({
								embeds: [kifo.embed("DEPLOYED!")],
								ephemeral: true,
							});
						}
						if (interaction.customId == "undeploy") {
							clientapp.commands.cache.each((cmd) =>
								cmd.delete()
							);
						}
						msg.edit({ components: [] });
					})
					.catch((err) => {
						main.log(err);
						msg.edit({ components: [] });
					})
			);
		return;
	}
	if (!client.commands.has(command)) {
		const embedreply = new Discord.MessageEmbed();
		embedreply
			.setColor("a039a0")
			.setAuthor(
				"Powered by Kifo Clanker™",
				null,
				`https://discord.gg/HxUFQCxPFp`
			)
			.setTitle(
				`Command ${command} not found. there is only \`${prefix}deploy\`.`
			);
		return message.reply({ embeds: [embedreply] }).catch(() => {});
	}
}

async function onmessage(message) {
	const prefix = await main.prefix(message.guild?.id);

	if (message.deleted) return;

	if (
		message.content === `<@!${client.user.id}>` ||
		message.content === `<@${client.user.id}>`
	) {
		return message
			.reply({
				embeds: [
					kifo.embed(
						`<:KifoClanker:863793928377729065> My prefix is: \`${prefix}\`\n\n<:online:823658022974521414> I'm online for **${ms(
							client.uptime,
							{ long: true }
						)}**.`,
						"Hello there!"
					),
				],
			})
			.catch(() => {});
	}

	speakcheck = checks(message, prefix);

	if (speakcheck) {
		if (
			!message.content.toLowerCase().startsWith(prefix.toLowerCase()) ||
			message.author.bot
		)
			return;

		if (
			message.content
				.toLowerCase()
				.startsWith(prefix.toLowerCase().trim()) &&
			message.content.length > prefix.length
		) {
			commands(message, prefix);
		}
	}
}

let clientapp;
//that's @KifoPL#3358
let Owner;

function dbPing() {
	con.query("SELECT * FROM invites", [], function (err,result) {
		if (err) throw err;
	});
}

client.once("ready", async () => {
	console.log("Kifo Clanker™ is online!");
	loadowner();
	module.exports.client = client;

	con.query(
		"SELECT Id, InviterId, RoleId, GuildId, ChannelId, Message FROM invites",
		[],
		function (err, result) {
			if (err) throw err;
			if (result.length > 0) {
				result.forEach((row) => {
					autoinvites.set(`${row.GuildId}${row.InviterId}`, {
						InviterId: row.InviterId,
						RoleId: row.RoleId,
						GuildId: row.GuildId,
						ChannelId: row.ChannelId,
						Message: row.Message,
					});
					client.guilds
						.resolve(row.GuildId)
						.invites.fetch()
						.then((invites) => {
							invites
								.filter((i) => i.inviter.id === row.InviterId)
								.each((invite) => {
									if (
										autoinvitesUses.has(
											`${row.GuildId}${row.InviterId}`
										)
									) {
										autoinvitesUses.set(
											`${row.GuildId}${row.InviterId}`,
											autoinvitesUses.get(
												`${row.GuildId}${row.InviterId}`
											) + invite.uses
										);
									} else {
										autoinvitesUses.set(
											`${row.GuildId}${row.InviterId}`,
											invite.uses
										);
									}
								});
						});
				});
				console.log(`Loaded ${result.length} invite managers!`);
			}
			module.exports.autoinvites = autoinvites;
			module.exports.autoinvitesUses = autoinvitesUses;
		}
	);

	//DELETING SLASH COMMANDS CODE FOR NOW, I tried using prebuilt API, but it was "too" prebuild and it didn't fit my bot at all. Will have to do stuff manually...

	//This line is executed by default, but I'm just making sure the status is online (other factors could change the status)
	updatePresence();
	setInterval(updatePresence, 1000 * 60);
	dbPing();
	setInterval(dbPing, 1000 * 60 * 60 * 5);
	console.log("Presence set!");
});

function updatePresence() {
	client.user.setStatus("online");
	client.user.setActivity({
		name: `I'm online for ${ms(client.uptime, { long: true })}.`,
		type: "PLAYING",
	});
}

client.on("interactionCreate", (interaction) => {
	let now = new Date(Date.now());
	if (!interaction.inGuild()) {
		interaction.reply({
			embeds: [
				kifo.embed(
					"Currently interactions only work in guilds. Sorry!"
				),
			],
		});
	}
	if (interaction.isCommand()) {
		if (
			!interaction.member.permissions.has(
				Discord.Permissions.FLAGS.ADMINISTRATOR
			)
		)
			return itr.reply({
				embeds: [kifo.embed("That's admin only bot sry.")],
			});
		main.log(
			`${interaction.user.tag} issued \`/${
				interaction.commandName
			}\` with these options:\n${interaction.options.data
				.map((o) => {
					if (o.type === "SUB_COMMAND") {
						return `${o.name}: ${o.options
							?.map((subo) => `**${subo.name}** - ${subo.value}`)
							.join(", ")}`;
					} else {
						return `- **${o.name}**: ${o.value}`;
					}
					//remember to add handling SUB_COMMAND_GROUP when I ever start using that
				})
				.join("\n")}\n*at <t:${Math.floor(
				now.getTime() / 1000
			)}>, <t:${Math.floor(now.getTime() / 1000)}:R>*.`
		);
		if (
			client.user.id == "796447999747948584" &&
			interaction.member?.roles.resolve("832194217493135400") == null
		)
			return interaction.reply({
				embeds: [kifo.embed("Only testers can use this bot.")],
			});
		if (client.slash_commands.has(interaction.commandName)) {
			client.slash_commands
				.get(interaction.commandName)
				.execute(interaction);
		} else {
			interaction.reply({
				embeds: [
					kifo.embed(
						"Unknown command! If this should not happen, please use `error` command and provide a description."
					),
				],
			});
		}
	}
});

client.on("messageCreate", (message) => {
	//this allows me to 1. catch stuff and 2. use async
	onmessage(message).catch((err) => {
		main.log(err);
	});
});

client.on("guildMemberAdd", async (member) => {
	autoinvites.forEach(async (val, key) => {
		if (key.startsWith(member.guild.id)) {
			let guild = member.guild;
			let inviterId = val.InviterId;
			let totalUses = 0;
			await guild.invites.fetch().then((invites) => {
				invites
					.filter((invite) => invite.inviter.id == inviterId)
					.each((i) => {
						totalUses += i.uses;
					});
				if (totalUses > autoinvitesUses.get(key)) {
					autoinvitesUses.set(key, totalUses);
					member.roles.add(
						val.RoleId,
						`Auto invite from ${inviterId}.`
					);
					if (val.Message != null) {
						member
							.send({
								embeds: [
									kifo.embed(val.Message, "Hello there!"),
								],
							})
							.catch(() => {
								guild.channels
									.resolve(val.ChannelId)
									.send({
										content: `<@!${member.id}>`,
										embeds: [
											kifo.embed(
												val.Message,
												"Hello there!"
											),
										],
									})
									.catch(() => {});
							});
					}
				}
			});
		}
	});
});

//kifo-advanced-logs
client.on("guildCreate", async (guild) => {
	let date = new Date(Date.now());
	let channel = client.guilds
		.resolve("822800862581751848")
		.channels?.resolve("863769411700785152");
	const embed = new Discord.MessageEmbed()
		.setColor("a039a0")
		.setThumbnail(guild.iconURL({ dynamic: true }))
		.setTitle("New Server!")
		.addField("Server Name", guild.name, true)
		.addField("Server Id", guild.id, true)
		.addField("Owner", `<@${guild.ownerId}>`, true)
		.addField("Member Count", guild.memberCount, true)
		.setFooter("Joined at: " + date.toUTCString());

	channel.send({ embeds: [embed] }).catch((err) => {
		main.log(err);
	});
});
//kifo-advanced-logs
client.on("guildDelete", (guild) => {
	let date = new Date(Date.now());
	let channel = client.guilds
		.resolve("822800862581751848")
		.channels?.resolve("863769411700785152");
	const embed = new Discord.MessageEmbed()
		.setColor("a039a0")
		.setThumbnail(guild.iconURL({ dynamic: true }))
		.setTitle("Removed from a server :(")
		.addField("Server Name", guild.name, true)
		.addField("Server Id", guild.id, true)
		.addField("Owner", `<@${guild.ownerId}>`, true)
		.addField("Member Count", guild.memberCount, true)
		.setFooter("Left at: " + date.toUTCString());

	channel.send({ embeds: [embed] }).catch((err) => {
		main.log(err);
	});
});
//kifo-logs
client.on("error", (err) => {
	main.log(err);
});
//kifo-logs
client.on("warn", (info) => {
	let channel = client.guilds
		.resolve("822800862581751848")
		.channels?.resolve("864112365896466432");
	return channel
		.send({ embeds: [kifo.embed(`${info}`, "WARNING")] })
		.catch((err) => {
			main.log(err);
		});
});
//kifo-advanced-logs
client.on("guildUnavailable", async (guild) => {
	let channel = client.guilds
		.resolve("822800862581751848")
		.channels("863769411700785152");
	let owner = guild.fetchOwner();
	channel
		.send({
			embeds: [
				kifo.embed(
					`A guild "${guild.name}", Id ${guild.id}, Owner: <@${guild.ownerId}>, ${owner.tag} has become unavailable!`
				),
			],
		})
		.catch((err) => {
			main.log(err);
		});
});

/**
 *
 * @param {string} guildId the Id of the guild you want to get prefix for.
 * @returns prefix for the guild (default "inv-")
 */
exports.prefix = async function (guildId) {
	return "inv-";
};

/**
 * Logs in #kifo-logs
 * @param {string} log the message you want to log
 * @returns Promise, in case something breaks
 */
exports.log = function (log, ...args) {
	let channel = client.guilds
		.resolve("822800862581751848")
		.channels?.resolve("864112365896466432");

	if (log instanceof Error) {
		const now = new Date(Date.now());
		return channel
			.send({
				content: `<@!289119054130839552>`,
				embeds: [
					kifo.embed(
						`${log.stack}\n\nAt <t:${Math.floor(
							now.getTime() / 1000
						)}>, <t:${Math.floor(
							now.getTime() / 1000
						)}:R>\nOther args: ${args.join(" ")}`,
						`CRITICAL ERROR`
					),
				],
			})
			.catch((err) => console.log(err));
	}
	return channel
		.send({ embeds: [kifo.embed(`${log} ${args.join(" ")}`, "LOG")] })
		.catch((err) => {
			main.log(err);
		});
};

client.login(process.env.LOGIN_TOKEN);

process.on("uncaughtException", async (err) => {
	console.error(err);
	console.log(err);
	await main.log(err);
});