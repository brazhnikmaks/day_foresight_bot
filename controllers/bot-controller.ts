import { Message } from "node-telegram-bot-api";
import bot from "../servises/telefram-service";
import db from "../servises/mongo-service";
import { getRandom } from "../utils";
import { ForesightDto } from "../dtos";

class BotController {
	waitForReply: {
		[key: number]: "hour";
	};

	constructor() {
		bot.setMyCommands([
			{ command: "/start", description: "Запуск бота" },
			{ command: "/foresight", description: "Передбачення" },
			{ command: "/subscribe", description: "Відписатися / Підписатися" },
			{ command: "/silent", description: "Без звуку / Зі звуком" },
			{ command: "/hour", description: "Змінити годину отримання" },
		]);
		this.waitForReply = {};
	}

	static async sendError(chatId: number) {
		await bot.sendMessage(chatId, `Помилочка  ¯\\_(ツ)_/¯`);
	}

	async onMessage(msg: Message) {
		const {
			text,
			chat: { id: chatId },
		} = msg;

		//start bot
		if (text === "/start") {
			try {
				await db.connect();
				try {
					await db.addChat(chatId);

					await bot.sendMessage(
						chatId,
						`Вітаю, Ви запустили щоденні передбачення.\n\nВи можете отримати *одне* передбачення на день (о 12:00).\n\nВи можете *відписатися* від щоденних передбачень.\n\nВи можете *запросити* передбачення раніше запланованого часу.\n\nВи можете налаштувати передбачення *без звуку оповіщення*.\n\nВи можете *змінити годину* отримання щоденних передбачень.\n\nОсь ваше передбачення на сьогодні:`,
						{
							parse_mode: "Markdown",
						},
					);

					//trigger first foresight
					try {
						await this.onMessage({
							text: "/foresight",
							chat: {
								id: chatId,
								type: "private",
							},
						} as Message);
					} catch (e) {
						console.error(e);
					}
				} catch (e) {
					try {
						await db.getChat(chatId);
						await db.chatSubscribe(chatId, true);
						return await bot.sendMessage(
							chatId,
							`Я вже знаю про вас все. Ви знову підписані на щоденні передбачення.`,
							{
								parse_mode: "Markdown",
							},
						);
					} catch (e) {
						await BotController.sendError(chatId);
					}
				}
			} catch (e) {
				await BotController.sendError(chatId);
			}
		}

		//get foresight
		if (text === "/foresight") {
			const dateNow = new Date(Date.now() + 120 * 60 * 1000).setUTCHours(
				0,
				0,
				0,
				0,
			);

			try {
				await db.connect();
				try {
					const { lastReceivedDate: chatDate, received } = await db.getChat(
						chatId,
					);

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

					let foresight: ForesightDto;
					if (!notReceivedForesights.length) {
						foresight = foresights[getRandom(foresights.length)];
						await db.updateChatReceived(chatId, foresight.id, true);
					} else {
						foresight =
							notReceivedForesights[getRandom(notReceivedForesights.length)];
						await db.updateChatReceived(chatId, foresight.id, false);
					}

					return await bot.sendMessage(chatId, `🥠 ${foresight.text}`);
				} catch (e) {
					await BotController.sendError(chatId);
				}
			} catch (e) {
				await BotController.sendError(chatId);
			}
		}

		//change subscribe
		if (text === "/subscribe") {
			try {
				await db.connect();
				try {
					const { subscribed } = await db.getChat(chatId);
					const newSub = !subscribed;

					await db.chatSubscribe(chatId, newSub);

					return await bot.sendMessage(
						chatId,
						newSub
							? "Ви підписалися на щоденні передбачення."
							: `Ви відписались від щоденних передбачень. Ви можете отримати передбачення в "Меню", але один раз на день.`,
						{
							parse_mode: "Markdown",
						},
					);
				} catch (e) {
					await BotController.sendError(chatId);
				}
			} catch (e) {
				await BotController.sendError(chatId);
			}
		}

		//change message silent
		if (text === "/silent") {
			try {
				await db.connect();
				try {
					const { silent } = await db.getChat(chatId);
					const newSilent = !silent;

					await db.chatSilent(chatId, newSilent);

					return await bot.sendMessage(
						chatId,
						newSilent
							? "🔇 Ваші пердбачення будуть надходити без звуку."
							: "🔈 Ваші пердбачення будуть надходити зі звуком.",
						{
							parse_mode: "Markdown",
						},
					);
				} catch (e) {
					await BotController.sendError(chatId);
				}
			} catch (e) {
				await BotController.sendError(chatId);
			}
		}

		//change time
		if (text === "/hour") {
			const timePrompt = await bot.sendMessage(
				chatId,
				"Добре, введіть годину отримання від 0 до 23 за українським часовим поясом",
				{
					parse_mode: "Markdown",
					reply_markup: {
						force_reply: true,
					},
				},
			);
			return (this.waitForReply[chatId] = "hour");
		}

		//reply
		if (this.waitForReply[chatId] === "hour") {
			const hour = Math.floor(Number(text));
			if (hour < 0 || hour > 23) {
				return await BotController.sendError(chatId);
			}

			try {
				await db.connect();
				try {
					await db.chatReceiveHour(chatId, hour);
					delete this.waitForReply[chatId];
					return await bot.sendMessage(
						chatId,
						`Час отримання щоденних передбачень змінено на ${hour}:00 за українським часовим поясом`,
						{
							parse_mode: "Markdown",
						},
					);
				} catch (e) {
					await BotController.sendError(chatId);
				}
			} catch (e) {
				await BotController.sendError(chatId);
			}
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

				await Promise.all(
					notReceivedChats.map(
						async ({ id, lastReceivedDate, silent, received }) => {
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
							} catch (e) {
								// @ts-ignore
								if (e.response.body.error_code === 403) {
									await db.chatSubscribe(id, false);
								}
							}
						},
					),
				);
			} catch (e) {}
		} catch (e) {}
	}
}

export default new BotController();
