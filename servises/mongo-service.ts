import { config } from "dotenv";
import mongoose, { Types } from "mongoose";
import { ForesightModel, ChatModel } from "../models";
import { ForesightDto, ChatDto } from "../dtos";
import { IChat } from "../types/chat";

config();
mongoose.set("strictQuery", false);

class MongoService {
	async connect() {
		try {
			const connect = await mongoose.connect(
				process.env.MONGO_DB_URL as string,
			);
			return connect;
		} catch (err) {
			console.log("Failed to connect to DB", err);
		}
	}

	async getForesights() {
		const foresights = await ForesightModel.find({});
		if (!foresights.length) {
			throw new Error("No foresights");
		}
		return foresights.map((foresight) => new ForesightDto(foresight));
	}

	async getChats(fillter: Partial<IChat> = {}) {
		const chats = await ChatModel.find(fillter);
		if (!chats.length) {
			throw new Error("No chats founded");
		}
		return chats.map((chat) => new ChatDto(chat));
	}

	async getChat(chatId: number) {
		const chat = await ChatModel.findOne({ id: chatId });
		if (!chat) {
			throw new Error("No chat founded");
		}
		return new ChatDto(chat);
	}

	async addChat(chatId: number) {
		const chat = await ChatModel.create({ id: chatId });
		return new ChatDto(chat);
	}

	async chatSilent(chatId: number, silent: boolean) {
		const chat = await ChatModel.findOneAndUpdate(
			{ id: chatId },
			{
				silent,
			},
			{
				new: true,
			},
		);
		if (!chat) {
			throw new Error("No chat founded");
		}
		return new ChatDto(chat);
	}

	async chatSubscribe(chatId: number, subscribed: boolean) {
		const chat = await ChatModel.findOneAndUpdate(
			{ id: chatId },
			{
				subscribed,
			},
			{
				new: true,
			},
		);
		if (!chat) {
			throw new Error("No chat founded");
		}
		return new ChatDto(chat);
	}

	async updateChatReceived(
		chatId: number,
		received: string,
		reset: boolean = false,
	) {
		const chat = await this.getChat(chatId);
		const chatReceived = reset ? [] : chat.received;

		const updatedChat = await ChatModel.findOneAndUpdate(
			{ id: chatId },
			{
				received: [...chatReceived, received].map((r) => new Types.ObjectId(r)),
				lastReceivedDate: new Date(Date.now() + 120 * 60 * 1000).setUTCHours(
					0,
					0,
					0,
					0,
				),
			},
			{
				new: true,
			},
		);
		if (!updatedChat) {
			throw new Error("No chat founded");
		}
		return new ChatDto(updatedChat);
	}
}

export default new MongoService();
