import { Message } from "node-telegram-bot-api";
import { bot } from "../servises/telefram-service";

class BotController {
	constructor() {
		bot.setMyCommands([{ command: "/start", description: "Запуск бота" }]);
	}

	static sendError(chatId: number) {
		bot.sendMessage(chatId, `Помилочка  ¯\\_(ツ)_/¯`);
	}

	async onMessage(msg: Message) {
		const text = msg.text;
		const chatId = msg.chat.id;

		try {
			if (text === "/start") {
				return bot.sendMessage(
					chatId,
					`Вітаю, Ви запустили щоденні передбачення о 12:00`,
				);
			}
		} catch (e) {
			console.log(e);
		}
	}
}

export default new BotController();
