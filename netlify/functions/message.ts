import { Handler, HandlerEvent } from "@netlify/functions";
import { Message } from "node-telegram-bot-api";
import botController from "../../controllers/bot-controller";

const handler: Handler = async (event: HandlerEvent) => {
	const message = JSON.parse(event.body!).message as Message;

	const messageController = botController.onMessage.bind(botController);

	console.log(
		JSON.stringify({
			username: message.from?.username,
			first_name: message.from?.first_name,
			last_name: message.from?.last_name,
			text: message.text,
		}),
	);

	await messageController(message);

	return { statusCode: 200 };
};

export { handler };
