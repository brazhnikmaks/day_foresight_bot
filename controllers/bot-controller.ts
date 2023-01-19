import { Message } from "node-telegram-bot-api";
import bot from "../servises/telefram-service";
import db from "../servises/mongo-service";
import { getRandom } from "../utils";
import { ChatDto, ForesightDto } from "../dtos";

class BotController {
	waitForReply: {
		[key: number]: "hour";
	};

	constructor() {
		this.setCommands();
		this.waitForReply = {};
	}

	async setCommands() {
		bot.setMyCommands([
			{ command: "/foresight", description: "🥠 Передбачення" },
			{ command: "/subscribe", description: "🔔 Підписатися" },
			{ command: "/unsubscribe", description: "🔕 Відписатися" },
			{ command: "/mute", description: "🔇 Без звуку" },
			{ command: "/unmute", description: "🔈 Зі звуком" },
			{ command: "/hour", description: "🕛 Година отримання" },
		]);
	}

	async sendError(chatId: number) {
		await bot.sendMessage(chatId, `Помилочка  ¯\\_(ツ)_/¯`);
	}

	async addLog(chat: ChatDto, action: string, message: string) {
		const { firstName, lastName, username, id } = chat;
		await db.addLog(
			firstName
				? `${firstName}${lastName ? ` ${lastName}` : ""}`
				: id.toString(),
			action,
			message,
			username,
		);
	}

	async onHelp(chatId: number) {
		let hour = 12;
		try {
			const chat = await db.getChat(chatId);
			hour = chat.receiveHour;
		} catch (e) {}

		return await bot.sendMessage(
			chatId,
			`Ви можете отримати *одне* передбачення на день (о ${hour}:00 за українським часовим поясом).\n\n/foresight - 🥠 Ви можете *запросити* передбачення раніше запланованого часу (але якщо ще не отримали)\n\n/unsubscribe - 🔕 Ви можете *відписатися* від щоденних передбачень.\n/subscribe - 🔔 Ви можете *відновити* підписку.\n\n/mute - 🔇 Ви можете налаштувати передбачення *без звуку оповіщення*.\n/unmute - 🔈 та *зі звуком*.\n\n/hour - 🕛 Ви можете *змінити годину* отримання щоденних передбачень.`,
			{
				parse_mode: "Markdown",
			},
		);
	}

	async onStart(msg: Message) {
		const {
			chat: { id: chatId },
			from,
		} = msg;

		try {
			const chat = await db.addChat(chatId, from);

			await bot.sendMessage(
				chatId,
				`Вітаю, Ви запустили щоденні передбачення.`,
			);

			await this.onHelp(chatId);

			await bot.sendMessage(chatId, `Ось ваше передбачення на сьогодні:`);

			//trigger first foresight
			try {
				await this.onForesight({
					text: "/foresight",
					chat: {
						id: chatId,
						type: "private",
					},
				} as Message);

				return;
			} catch (e) {
				console.error(e);
			}

			await this.setCommands();

			//log
			await this.addLog(chat, "/start", "Приєднався до бота");
		} catch (e) {
			try {
				const { subscribed } = await db.getChat(chatId);
				if (subscribed) {
					await bot.sendMessage(
						chatId,
						`Я вже знаю про вас все. Чекайте на наступне передбачення.`,
					);
					await this.setCommands();
				} else {
					await db.chatSubscribe(chatId, true);
					await bot.sendMessage(
						chatId,
						`Я вже знаю про вас все. Ви знову підписані на щоденні передбачення.`,
					);
					await this.setCommands();
				}
			} catch (e) {
				await this.sendError(chatId);
			}
		}
	}

	async onForesight(msg: Message) {
		const {
			chat: { id: chatId },
		} = msg;

		const dateNow = new Date(Date.now() + 120 * 60 * 1000).setUTCHours(
			0,
			0,
			0,
			0,
		);

		try {
			const chat = await db.getChat(chatId);
			const { lastReceivedDate: chatDate, received } = chat;

			const isAlreadyReceived =
				chatDate && dateNow - new Date(chatDate).getTime() < 86400000;
			if (isAlreadyReceived) {
				return await bot.sendMessage(
					chatId,
					"🚫 Один день - одне передбачення.",
				);
			}

			const foresights = await db.getForesights();

			const notReceivedForesights = foresights.filter(
				(foresight) => !received.includes(foresight.id),
			);

			//log
			let foresight: ForesightDto;

			if (!notReceivedForesights.length) {
				foresight = foresights[getRandom(foresights.length)];
				await db.updateChatReceived(chatId, foresight.id, true);
			} else {
				foresight =
					notReceivedForesights[getRandom(notReceivedForesights.length)];
				await db.updateChatReceived(chatId, foresight.id, false);
			}

			await bot.sendMessage(chatId, `🥠 ${foresight.text}`);

			//log
			await this.addLog(chat, "/foresight", foresight.text);
		} catch (e) {
			await this.sendError(chatId);
		}
	}

	async onSubscribe(msg: Message, subscribe: boolean) {
		const {
			chat: { id: chatId },
		} = msg;

		try {
			const chat = await db.getChat(chatId);

			if (chat.subscribed === subscribe) {
				return await bot.sendMessage(
					chatId,
					subscribe
						? "🔔 Ви вже підписані на щоденні передбачення."
						: "🔕 Ви вже відписані від щоденних передбачень",
				);
			}

			await db.chatSubscribe(chatId, subscribe);

			await bot.sendMessage(
				chatId,
				subscribe
					? "🔔 Ви підписалися на щоденні передбачення."
					: `🔕 Ви відписались від щоденних передбачень. Ви можете отримати передбачення в "Меню", але один раз на день.`,
			);

			//log
			await this.addLog(
				chat,
				subscribe ? "/subscribe" : "/unsubscribe",
				subscribe ? "Підписався" : "Відписався",
			);

			return;
		} catch (e) {
			await this.sendError(chatId);
		}
	}

	async onMute(msg: Message, mute: boolean) {
		const {
			chat: { id: chatId },
		} = msg;

		try {
			const chat = await db.getChat(chatId);

			if (chat.silent === mute) {
				return await bot.sendMessage(
					chatId,
					mute
						? "🔇 Ви вже отримуєте пердбачення без звуку"
						: "🔈 Ви вже отримуєте пердбачення зі звуком",
				);
			}

			await db.chatSilent(chatId, mute);

			await bot.sendMessage(
				chatId,
				mute
					? "🔇 Ваші пердбачення будуть надходити без звуку."
					: "🔈 Ваші пердбачення будуть надходити зі звуком.",
			);

			//log
			await this.addLog(
				chat,
				mute ? "/mute" : "/unmute",
				mute ? "Прибрав звук" : "Повернув звук",
			);

			return;
		} catch (e) {
			await this.sendError(chatId);
		}
	}

	async onHour(msg: Message) {
		const {
			chat: { id: chatId },
		} = msg;

		await bot.sendMessage(
			chatId,
			"Добре, введіть годину отримання від 0 до 23 за українським часовим поясом",
			{
				parse_mode: "Markdown",
				reply_markup: {
					force_reply: true,
				},
			},
		);
		this.waitForReply[chatId] = "hour";
		return;
	}

	async onHourReply(msg: Message) {
		const {
			text,
			chat: { id: chatId },
		} = msg;

		const hour = Math.floor(Number(text));
		if (hour < 0 || hour > 23) {
			return await this.sendError(chatId);
		}

		try {
			const chat = await db.chatReceiveHour(chatId, hour);

			delete this.waitForReply[chatId];
			await bot.sendMessage(
				chatId,
				`Час отримання щоденних передбачень змінено на ${hour}:00 за українським часовим поясом`,
			);

			//log
			await this.addLog(chat, "/hour", `Новий час оповіщень: ${hour}:00`);

			return;
		} catch (e) {
			await this.sendError(chatId);
		}
	}

	async onAction(msg: Message) {
		const {
			text,
			chat: { id: chatId },
		} = msg;

		try {
			await db.connect();
			switch (text) {
				//start bot
				case "/start":
					await this.onStart(msg);
					return;
				//get foresight
				case "/foresight":
					await this.onForesight(msg);
					return;
				//subscribe
				case "/subscribe":
					await this.onSubscribe(msg, true);
					return;
				//unsubscribe
				case "/unsubscribe":
					await this.onSubscribe(msg, false);
					return;
				//mute
				case "/mute":
					await this.onMute(msg, true);
					return;
				//unmute
				case "/unmute":
					await this.onMute(msg, false);
					return;
				//chanhe hour
				case "/hour":
					await this.onHour(msg);
					return;
				//wait reply
				case "/hour":
					await this.onHour(msg);
					return;
				default:
					if (this.waitForReply[chatId] === "hour") {
						await this.onHourReply(msg);
						return;
					}
					await this.onHelp(chatId);
					return;
			}
		} catch (e) {
			this.sendError(chatId);
		}
	}

	async foresightForAll() {
		const dateNow = new Date(Date.now() + 120 * 60 * 1000);
		const currentHour = dateNow.getHours();
		const beginDateTime = dateNow.setUTCHours(0, 0, 0, 0);

		try {
			await db.connect();
			try {
				const chats = await db.getChats({
					subscribed: true,
					receiveHour: currentHour,
				});

				const notReceivedChats = chats.filter(
					({ lastReceivedDate }) =>
						!(
							lastReceivedDate &&
							beginDateTime - new Date(lastReceivedDate).getTime() < 86400000
						),
				);

				if (!notReceivedChats.length) {
					return;
				}

				const foresights = await db.getForesights();

				//log
				let logMessage: string = "";

				await Promise.all(
					notReceivedChats.map(
						async (
							{ id, lastReceivedDate, silent, received, firstName, lastName },
							index,
						) => {
							const isAlreadyReceived =
								lastReceivedDate &&
								beginDateTime - new Date(lastReceivedDate).getTime() < 86400000;
							if (isAlreadyReceived) return;

							const notReceivedForesights = foresights.filter(
								(foresight) => !received.includes(foresight.id),
							);

							let foresight: ForesightDto;
							if (!notReceivedForesights.length) {
								foresight = foresights[getRandom(foresights.length)];
								await db.updateChatReceived(id, foresight.id, true);
							} else {
								foresight =
									notReceivedForesights[
										getRandom(notReceivedForesights.length)
									];
								await db.updateChatReceived(id, foresight.id, false);
							}

							try {
								await bot.sendMessage(id, `🥠 ${foresight.text}`, {
									disable_notification: silent,
								});

								//log
								logMessage += `${index > 0 ? "\n" : ""}${
									firstName
										? `${firstName}${lastName ? ` ${lastName}` : ""}`
										: id.toString()
								}: ${foresight.text}`;
							} catch (e) {
								// @ts-ignore
								if (e.response.body.error_code === 403) {
									await db.chatSubscribe(id, false);
								}
							}
						},
					),
				);

				//log
				await this.addLog(
					{
						firstName: "bot",
						username: "day_foresight_bot",
					} as ChatDto,
					"hour shedule",
					logMessage,
				);

				return;
			} catch (e) {}
		} catch (e) {}
	}
}

export default new BotController();
