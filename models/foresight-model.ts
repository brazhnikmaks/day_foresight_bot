import { Schema, model } from "mongoose";
import { IForesight } from "../types/foresight";

const ForesightSchema = new Schema<IForesight>({
	text: { type: String, unique: true, required: true },
});

export default model<IForesight>("Foresight", ForesightSchema);
