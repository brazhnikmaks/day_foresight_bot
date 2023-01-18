import { HydratedDocument } from "mongoose";
import { ILog } from "../types/log";

class LogDto implements ILog {
	user: string;
	userLink?: string;
	action: string;
	message: string;
	createdAt: Date;

	constructor(model: HydratedDocument<ILog>) {
		this.user = model.user;
		this.userLink = model.userLink;
		this.action = model.action;
		this.message = model.message;
		this.createdAt = model.createdAt;
	}
}

export default LogDto;
