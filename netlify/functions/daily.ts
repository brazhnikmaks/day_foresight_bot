import { Handler, schedule } from "@netlify/functions";
import botController from "../../controllers/bot-controller";

const dailyHandler: Handler = async () => {
	await botController.dailyForesight.bind(botController)();

	return { statusCode: 200 };
};

const handler = schedule("50 * * * *", dailyHandler);

export { handler };
