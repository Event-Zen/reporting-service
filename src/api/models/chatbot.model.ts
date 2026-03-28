import { Schema, model, Document } from "mongoose";

export type ChatMessageSender = "user" | "bot";

export interface IChatMessage {
  sender: ChatMessageSender;
  text: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface IChatbotHistory extends Document {
  chatId: string;
  userId: string;
  title: string;
  messages: IChatMessage[];
  status: "OPEN" | "CLOSED" | "ARCHIVED";
  source: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const ChatMessageSchema = new Schema<IChatMessage>(
  {
    sender: { type: String, enum: ["user", "bot"], required: true },
    text: { type: String, required: true, trim: true },
    timestamp: { type: Date, required: true, default: Date.now },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const ChatbotSchema = new Schema<IChatbotHistory>(
  {
    chatId: { type: String, required: true, index: true, trim: true },
    userId: { type: String, required: true, index: true, trim: true },
    title: { type: String, required: true, trim: true },
    messages: { type: [ChatMessageSchema], default: [] },
    status: { type: String, enum: ["OPEN", "CLOSED", "ARCHIVED"], default: "OPEN" },
    source: { type: String, default: "chatbot" },
    tags: { type: [String], default: [] },
  },
  { timestamps: true }
);

export const ChatbotHistory = model<IChatbotHistory>("ChatbotHistory", ChatbotSchema);
