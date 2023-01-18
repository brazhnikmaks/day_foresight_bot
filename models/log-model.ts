import { Schema, model } from "mongoose";
import { ILog } from "../types/log";

const LogSchema = new Schema<ILog>({
	user: { type: String, required: true },
	userLink: { type: String },
	action: { type: String, required: true },
	message: { type: String, required: true },
	createdAt: { type: Date, default: Date.now },
});

export default model<ILog>("Log", LogSchema);
