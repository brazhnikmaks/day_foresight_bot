import { Handler, schedule } from "@netlify/functions";
import botController from "../../controllers/bot-controller";

const dailyHandler: Handler = async () => {
	const dailyController = botController.dailyForesight.bind(botController);
	await dailyController();

	return { statusCode: 200 };
};

const handler = schedule("@daily", dailyHandler);

export { handler };
