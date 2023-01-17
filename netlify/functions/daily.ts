import { Handler, schedule } from "@netlify/functions";
import botController from "../../controllers/bot-controller";

const dailyHandler: Handler = async () => {
	await botController.foresightForAll.bind(botController)();

	return { statusCode: 200 };
};

const handler = schedule("0 * * * *", dailyHandler);

export { handler };
