import { Schema, model } from "mongoose";
import { IChat } from "../types/chat";

const ChatSchema = new Schema<IChat>({
	id: { type: Number, unique: true, required: true },
	subscribed: { type: Boolean, default: true },
	silent: { type: Boolean, default: false },
	lastReceivedDate: { type: Date },
	received: [{ type: Schema.Types.ObjectId, ref: "Foresight" }],
});

export default model<IChat>("Chat", ChatSchema);
