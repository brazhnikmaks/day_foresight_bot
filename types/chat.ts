import { ObjectId } from "mongoose";

export interface IChat {
	id: number;
	subscribed: boolean;
	silent: boolean;
	lastReceivedDate: Date;
	received: ObjectId[];
	receiveHour: number;
}

export interface IChatDto extends Omit<IChat, "received"> {
	received: string[];
}
