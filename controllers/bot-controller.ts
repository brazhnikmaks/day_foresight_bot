import { Message } from "node-telegram-bot-api";
import bot from "../servises/telefram-service";
import db from "../servises/mongo-service";
import { getRandom } from "../utils";
import { ForesightDto } from "../dtos";

class BotController {
	constructor() {
		bot.setMyCommands([
			{ command: "/start", description: "Запуск бота" },
			{ command: "/foresight", description: "Передбачення" },
			{ command: "/subscribe", description: "Відписатися / Підписатися" },
			{ command: "/silent", description: "Без звуку / Зі звуком" },
		]);
	}

	static async sendError(chatId: number) {
		await bot.sendMessage(chatId, `Помилочка  ¯\\_(ツ)_/¯`);
	}

	async onMessage(msg: Message) {
		const {
			text,
			chat: { id: chatId },
			date,
		} = msg;
		const gmt = new Date(+`${date}000`).getTimezoneOffset();

		console.log(msg);

		if (text === "/start") {
			try {
				await db.connect();
				try {
					await db.addChat(chatId, gmt);

					let gtmHours = Math.round(10 - gmt / 60) % 24;
					if (gtmHours < 0) {
						gtmHours = Math.abs(24 + gtmHours);
					}
					await bot.sendMessage(
						chatId,
						`Вітаю, Ви запустили щоденні передбачення.\n\nВи можете отримати *одне* передбачення на день (о ${gtmHours}:00).\n\nВи можете *відписатися* від щоденних передбачень.\n\nВи можете *запросити* передбачення раніше запланованого часу.\n\nВи можете налаштувати передбачення *без звуку оповіщення*.\n\nОсь ваше передбачення на сьогодні:`,
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
							date,
						} as Message);
					} catch (e) {
						console.error(e);
					}
				} catch (e) {
					try {
						await db.getChat(chatId);
						await db.chatSubscribe(chatId, true, gmt);
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

		if (text === "/foresight") {
			const dateNow = new Date(Date.now() - gmt * 60 * 1000).setUTCHours(
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
						await db.updateChatReceived(chatId, foresight.id, true, gmt);
					} else {
						foresight =
							notReceivedForesights[getRandom(notReceivedForesights.length)];
						await db.updateChatReceived(chatId, foresight.id, false, gmt);
					}

					return await bot.sendMessage(chatId, `🥠 ${foresight.text}`);
				} catch (e) {
					await BotController.sendError(chatId);
				}
			} catch (e) {
				await BotController.sendError(chatId);
			}
		}

		if (text === "/subscribe") {
			try {
				await db.connect();
				try {
					const { subscribed } = await db.getChat(chatId);
					const newSub = !subscribed;

					await db.chatSubscribe(chatId, newSub, gmt);

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

		if (text === "/silent") {
			try {
				await db.connect();
				try {
					const { silent } = await db.getChat(chatId);
					const newSilent = !silent;

					await db.chatSilent(chatId, newSilent, gmt);

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
	}

	async dailyForesight() {
		try {
			await db.connect();
			try {
				const [foresights, chats] = await Promise.all([
					db.getForesights(),
					db.getChats({ subscribed: true }),
				]);

				await Promise.all(
					chats.map(async ({ id, lastReceivedDate, silent, gmt, received }) => {
						const dateNow = new Date(Date.now() - gmt * 60 * 1000).setUTCHours(
							0,
							0,
							0,
							0,
						);
						const isAlreadyReceived =
							lastReceivedDate &&
							dateNow - new Date(lastReceivedDate).getTime() < 86400000;
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
								notReceivedForesights[getRandom(notReceivedForesights.length)];
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
					}),
				);
			} catch (e) {}
		} catch (e) {}
	}
}

export default new BotController();
