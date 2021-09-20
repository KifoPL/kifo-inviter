const kifo = require("kifo");
const Discord = require("discord.js");

module.exports = {
	name: "invite",
	description: "Manage auto-role adding to invites.",
	options: [
		{
			name: "new",
			type: "SUB_COMMAND",
			description: "Create new auto-role.",
			options: [
				{
					name: "inviter",
					type: "USER",
					description: "The user, whose invites will be tracked.",
					required: true,
				},
				{
					name: "role",
					type: "ROLE",
					description: "The role to auto-invite for the user.",
					required: true,
				},
				{
					name: "channel",
					type: "CHANNEL",
					description:
						"The text channel where the user will be welcomed.",
				},
				{
					name: "message",
					type: "STRING",
					description: "The welcome message.",
				},
			],
		},
		{
			name: "delete",
			type: "SUB_COMMAND",
			description: "Delete current auto-role.",
			options: [
				{
					name: "inviter",
					type: "USER",
					description:
						"The user, whom invites you don't want to track anymore.",
					required: true,
				},
			],
		},
		{
			name: "list",
			type: "SUB_COMMAND",
			description: "Lists all auto-invites.",
		},
	],
	defaultPermission: true,
	perms: ["USE_SLASH_COMMANDS"],

	//itr = interaction
	async execute(itr) {
		await itr.deferReply({ ephemeral: true });
		const { autoinvites, con, autoinvitesUses } = require(`../index.js`);
		let subcmd = itr.options.data[0];
		if (subcmd.name === "new") {
			let inviter = subcmd.options.find(
				(o) => o.name === "inviter"
			).member;
			let role = subcmd.options.find((o) => o.name === "role").role;
			let channel = subcmd.options.find(
				(o) => o.name === "channel"
			)?.channel;
			let message = subcmd.options.find(
				(o) => o.name === "message"
			)?.value;
			if (autoinvites.has(`${itr.guildId}${inviter.id}`))
				return itr
					.editReply({
						embeds: [
							kifo.embed(
								"There's already an auto-inviter set for this person!",
								"INFO:",
								itr.user,
								itr.client
							),
						],
						ephemeral: true,
					})
					.catch(() => {});
			if (
				channel != null &&
				channel.type !== "GUILD_NEWS" &&
				channel.type !== "GUILD_TEXT"
			)
				return itr.editReply({
					embeds: [
						kifo.embed(
							"The channel must be a text channel.",
							"INFO:",
							itr.user,
							itr.client
						),
					],
					ephemeral: true,
				});
			if (message != null && message.length > 2000)
				return itr.editReply({
					embeds: [
						kifo.embed(
							"The message cannot exceed 2000 characters.",
							"INFO:",
							itr.user,
							itr.client
						),
					],
					ephemeral: true,
				});
			try {
				con.query(
					"INSERT INTO invites (InviterId , RoleId, GuildId , ChannelId , Message) VALUES (?, ?, ?, ?, ?)",
					[inviter.id, role.id, itr.guildId, channel?.id, message],
					async function (err) {
						if (err) throw err;
						autoinvites.set(`${itr.guildId}${inviter.id}`, {
							InviterId: inviter.id,
							RoleId: role.id,
							GuildId: itr.guildId,
							ChannelId: channel?.id,
							Message: message ?? null,
						});
						let uses = 0;
						await itr.guild.invites.fetch().then((invites) => {
							invites
								.filter(
									(invites) =>
										invites.inviter.id == inviter.id
								)
								.each((i) => {
									uses += i.uses;
								});
						});
						autoinvitesUses.set(
							`${itr.guildId}${inviter.id}`,
							uses
						);
						itr.editReply({
							embeds: [
								kifo.embed(
									"Succesfully added new auto-invite!",
									"INFO:",
									itr.user,
									itr.client
								),
							],
							ephemeral: false,
						});
					}
				);
			} catch (err) {
				return itr.editReply({
					embeds: [kifo.embed(err)],
					ephemeral: true,
				});
			}
		}
		if (subcmd.name === "delete") {
			let inviter = subcmd.options.find(
				(o) => o.name === "inviter"
			).member;
			if (!autoinvites.has(`${itr.guildId}${inviter.id}`))
				return itr.editReply({
					embeds: [
						kifo.embed(
							"There is nothing to delete!",
							"INFO:",
							itr.user,
							itr.client
						),
					],
					ephemeral: true,
				});
			try {
				con.query(
					"DELETE FROM invites WHERE GuildId = ? AND InviterId = ?",
					[itr.guildId, inviter.id],
					function (err) {
						if (err) throw err;
						autoinvites.delete(`${itr.guildId}${inviter.id}`);
						autoinvitesUses.delete(`${itr.guildId}${inviter.id}`);
						return itr.editReply({
							embeds: [
								kifo.embed(
									`Succesfully deleted auto-invite feature for <@!${inviter.id}>!`,
									`INFO:`,
									itr.user,
									itr.client
								),
							],
							ephemeral: false,
						});
					}
				);
			} catch (err) {
				return itr.editReply({
					embeds: [kifo.embed(err)],
					ephemeral: true,
				});
			}
		}
		if (subcmd.name === "list") {
			let replyEmbed = kifo.embed(
				"",
				"List of enabled auto-invites:",
				itr.user,
				itr.client
			);
			autoinvites.forEach((val, key) => {
				if (key.startsWith(`${itr.guildId}`)) {
					replyEmbed.addField(
						`${itr.guild.members.resolve(val.InviterId).displayName}`,
						`People invited by <@!${val.InviterId}> receive <@&${
							val.RoleId
						}>.${
							val.Message != null
								? `\n\nMessage sent in DMs (or in <#${val.ChannelId}>):\n${val.Message}`
								: ""
						}`
					);
				}
			});
			itr.editReply({ embeds: [replyEmbed], ephemeral: true });
		}
	},
	async button(itr) {
		itr.reply({ embeds: [kifo.embed("Hello there!")] });
	},
	async selectMenu(itr) {},
};
