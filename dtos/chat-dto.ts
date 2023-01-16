import { HydratedDocument } from "mongoose";
import { IChat, IChatDto } from "../types/chat";

class ChatDto implements IChatDto {
	id: number;
	subscribed: boolean;
	silent: boolean;
	gmt: number;
	lastReceivedDate: Date;
	received: string[];

	constructor(model: HydratedDocument<IChat>) {
		this.id = model.id;
		this.subscribed = model.subscribed;
		this.silent = model.silent;
		this.gmt = model.gmt;
		this.lastReceivedDate = model.lastReceivedDate;
		this.received = model.received.map((received) => received.toString());
	}
}

export default ChatDto;
