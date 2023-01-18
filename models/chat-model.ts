import { Schema, model } from "mongoose";
import { IChat } from "../types/chat";

const ChatSchema = new Schema<IChat>({
	id: { type: Number, unique: true, required: true },
	subscribed: { type: Boolean, default: true },
	silent: { type: Boolean, default: false },
	lastReceivedDate: { type: Date },
	received: [{ type: Schema.Types.ObjectId, ref: "Foresight" }],
	receiveHour: { type: Number, min: 0, max: 23, default: 12 },
	firstName: { type: String },
	lastName: { type: String },
	username: { type: String },
});

export default model<IChat>("Chat", ChatSchema);
