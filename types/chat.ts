import { ObjectId } from "mongoose";

export interface IChat {
	id: number;
	subscribed: boolean;
	silent: boolean;
	gmt: number;
	lastReceivedDate: Date;
	received: ObjectId[];
}

export interface IChatDto extends Omit<IChat, "received"> {
	received: string[];
}
