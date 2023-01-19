import {
	Message,
	SendMessageOptions,
	KeyboardButton,
} from "node-telegram-bot-api";
import bot from "../servises/telefram-service";
import db from "../servises/mongo-service";
import { getRandom, getTimeIcon } from "../utils";
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
			{ command: "/help", description: "📄 Допомога" },
		]);
	}

	setReplyKeyboard(chat: ChatDto): SendMessageOptions {
		const { receiveHour, subscribed, silent } = chat;

		const keyboard: KeyboardButton[][] = [];

		keyboard.push(
			[
				{
					text: "🥠 Передбачення",
				},
			],
			[
				{
					text: subscribed ? "🔕 Відписатися" : "🔔 Підписатися",
				},
				{
					text: silent ? "🔈 Зі звуком" : "🔇 Без звуку",
				},
			],
			[
				{
					text: `${getTimeIcon(
						receiveHour,
					)} Змінити годину (${receiveHour}:00)`,
				},
			],
		);

		return {
			reply_markup: {
				resize_keyboard: true,
				keyboard,
			},
		};
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
		let chat = {} as ChatDto;
		try {
			chat = await db.getChat(chatId);
			hour = chat.receiveHour;
		} catch (e) {}

		const timeIcon = getTimeIcon(hour);

		return await bot.sendMessage(
			chatId,
			`Ви можете отримати *одне* передбачення на день (о ${timeIcon} ${hour}:00 за українським часовим поясом).\n\n/foresight - 🥠 Ви можете *запросити* передбачення раніше запланованого часу (але якщо ще не отримали сьогодні).\n\n/unsubscribe - 🔕 Ви можете *відписатися* від щоденних передбачень.\n/subscribe - 🔔 Ви можете *відновити* підписку.\n\n/mute - 🔇 Ви можете налаштувати передбачення *без звуку оповіщення*.\n/unmute - 🔈 та *зі звуком*.\n\n/hour - ${timeIcon} Ви можете *змінити годину* отримання щоденних передбачень.`,
			{
				...(chat.id ? this.setReplyKeyboard(chat) : {}),
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
				this.setReplyKeyboard(chat),
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
				const chat = await db.getChat(chatId);
				const { subscribed } = chat;
				if (subscribed) {
					await bot.sendMessage(
						chatId,
						`Я вже знаю про вас все. Чекайте на наступне передбачення.`,
						this.setReplyKeyboard(chat),
					);
					await this.setCommands();
				} else {
					await db.chatSubscribe(chatId, true);
					await bot.sendMessage(
						chatId,
						`Я вже знаю про вас все. Ви знову підписані на щоденні передбачення.`,
						this.setReplyKeyboard(chat),
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
			let chat = await db.getChat(chatId);
			const { lastReceivedDate: chatDate, received } = chat;

			const isAlreadyReceived =
				chatDate && dateNow - new Date(chatDate).getTime() < 86400000;
			if (isAlreadyReceived) {
				return await bot.sendMessage(
					chatId,
					"🚫 Один день - одне передбачення.",
					this.setReplyKeyboard(chat),
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
				chat = await db.updateChatReceived(chatId, foresight.id, true);
			} else {
				foresight =
					notReceivedForesights[getRandom(notReceivedForesights.length)];
				chat = await db.updateChatReceived(chatId, foresight.id, false);
			}

			await bot.sendMessage(
				chatId,
				`🥠 ${foresight.text}`,
				this.setReplyKeyboard(chat),
			);

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
			let chat = await db.getChat(chatId);

			if (chat.subscribed === subscribe) {
				return await bot.sendMessage(
					chatId,
					subscribe
						? "🔔 Ви вже підписані на щоденні передбачення."
						: "🔕 Ви вже відписані від щоденних передбачень",
					this.setReplyKeyboard(chat),
				);
			}

			chat = await db.chatSubscribe(chatId, subscribe);

			await bot.sendMessage(
				chatId,
				subscribe
					? "🔔 Ви підписалися на щоденні передбачення."
					: `🔕 Ви відписались від щоденних передбачень. Ви можете отримати передбачення в "Меню", але один раз на день.`,
				this.setReplyKeyboard(chat),
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
			let chat = await db.getChat(chatId);

			if (chat.silent === mute) {
				return await bot.sendMessage(
					chatId,
					mute
						? "🔇 Ви вже отримуєте пердбачення без звуку"
						: "🔈 Ви вже отримуєте пердбачення зі звуком",
					this.setReplyKeyboard(chat),
				);
			}

			chat = await db.chatSilent(chatId, mute);

			await bot.sendMessage(
				chatId,
				mute
					? "🔇 Ваші пердбачення будуть надходити без звуку."
					: "🔈 Ваші пердбачення будуть надходити зі звуком.",
				this.setReplyKeyboard(chat),
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
					remove_keyboard: true,
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

		const timeIcon = getTimeIcon(hour);

		try {
			const chat = await db.chatReceiveHour(chatId, hour);
			delete this.waitForReply[chatId];
			await bot.sendMessage(
				chatId,
				`${timeIcon} Час отримання щоденних передбачень змінено на ${hour}:00 за українським часовим поясом`,
				this.setReplyKeyboard(chat),
			);

			//log
			await this.addLog(chat, "/hour", `Новий час оповіщень: ${hour}:00`);

			return;
		} catch (e) {
			await this.sendError(chatId);
		}
	}

	async onAction(msg: Message) {
		let {
			text,
			chat: { id: chatId },
		} = msg;

		text = text?.replace(/^[\s\S]*?(Змінити годину)[\s\S]*?$/, "$1");

		try {
			await db.connect();
			switch (text) {
				//start bot
				case "/start":
					await this.onStart(msg);
					return;
				//get foresight
				case "/foresight":
				case "🥠 Передбачення":
					await this.onForesight(msg);
					return;
				//subscribe
				case "/subscribe":
				case "🔔 Підписатися":
					await this.onSubscribe(msg, true);
					return;
				//unsubscribe
				case "/unsubscribe":
				case "🔕 Відписатися":
					await this.onSubscribe(msg, false);
					return;
				//mute
				case "/mute":
				case "🔇 Без звуку":
					await this.onMute(msg, true);
					return;
				//unmute
				case "/unmute":
				case "🔈 Зі звуком":
					await this.onMute(msg, false);
					return;
				//chanhe hour
				case "/hour":
				case "Змінити годину":
					await this.onHour(msg);
					return;
				case "/help":
					await this.onHelp(chatId);
					return;
				default:
					//wait reply
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
							let chat: ChatDto;
							if (!notReceivedForesights.length) {
								foresight = foresights[getRandom(foresights.length)];
								chat = await db.updateChatReceived(id, foresight.id, true);
							} else {
								foresight =
									notReceivedForesights[
										getRandom(notReceivedForesights.length)
									];
								chat = await db.updateChatReceived(id, foresight.id, false);
							}

							try {
								await bot.sendMessage(id, `🥠 ${foresight.text}`, {
									...this.setReplyKeyboard(chat),
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
