import { HydratedDocument } from "mongoose";
import { IChat, IChatDto, ChatRoleType } from "../types/chat";

class ChatDto implements IChatDto {
	id: number;
	subscribed: boolean;
	silent: boolean;
	lastReceivedDate: Date;
	received: string[];
	receiveHour: number;
	firstName?: string;
	lastName?: string;
	username?: string;

	constructor(model: HydratedDocument<IChat>) {
		this.id = model.id;
		this.subscribed = model.subscribed;
		this.silent = model.silent;
		this.lastReceivedDate = model.lastReceivedDate;
		this.received = model.received.map((received) => received.toString());
		this.receiveHour = model.receiveHour;
		this.firstName = model.firstName;
		this.lastName = model.lastName;
		this.username = model.username;
	}
}

export default ChatDto;
