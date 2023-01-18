import { ObjectId } from "mongoose";

export type ChatRoleType = "member" | "owner" | "dev";

export interface IChat {
	id: number;
	subscribed: boolean;
	silent: boolean;
	lastReceivedDate: Date;
	received: ObjectId[];
	receiveHour: number;
	firstName?: string;
	lastName?: string;
	username?: string;
}

export interface IChatDto extends Omit<IChat, "received"> {
	received: string[];
}
