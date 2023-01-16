import { HydratedDocument } from "mongoose";
import { IForesight, IForesightDto } from "../types/foresight";

class ForesightDto implements IForesightDto {
	id: string;
	text: string;

	constructor(model: HydratedDocument<IForesight>) {
		this.id = model._id.toString();
		this.text = model.text;
	}
}

export default ForesightDto;
