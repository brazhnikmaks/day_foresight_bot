import { Handler, schedule } from "@netlify/functions";
import botController from "../../controllers/bot-controller";

const dailyHandler: Handler = async () => {
	await botController.dailyForesight();

	return { statusCode: 200 };
};

const handler = schedule("@daily", dailyHandler);

export { handler };
