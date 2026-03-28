import { Request, Response } from "express";
import { ChatbotHistory } from "../models/chatbot.model";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { v4 as uuidv4 } from "uuid";

const geminiApiKey = process.env.GEMINI_API_KEY;
if (!geminiApiKey) {
  throw new Error("GEMINI_API_KEY is required for chatbot Gemini integration.");
}

const genAI = new GoogleGenerativeAI(geminiApiKey);

export const sendMessage = async (req: Request, res: Response) => {
  try {
    const { userId, chatId, message } = req.body;
    let currentChatId = chatId;
    let chatSession = null;

    if (currentChatId) {
      chatSession = await ChatbotHistory.findOne({ chatId: currentChatId, userId });
    }

    if (!chatSession) {
      currentChatId = uuidv4();
      const title = message.length > 30 ? message.substring(0, 30) + "..." : message;
      chatSession = new ChatbotHistory({ chatId: currentChatId, userId, title, messages: [] });
    }

    chatSession.messages.push({ sender: "user", text: message, timestamp: new Date() });

    const formattedHistory = chatSession.messages.slice(0, -1).map((msg) => ({
      role: msg.sender === "bot" ? "model" : "user",
      parts: [{ text: msg.text }],
    }));

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const chat = model.startChat({ history: formattedHistory });
    
    const result = await chat.sendMessage(message);
    const botResponseText = result.response.text();

    chatSession.messages.push({ sender: "bot", text: botResponseText, timestamp: new Date() });
    await chatSession.save();

    res.status(200).json({
      chatId: currentChatId,
      title: chatSession.title,
      messages: chatSession.messages,
    });
  } catch (error) {
    console.error("Error in chatbot controller:", error);
    res.status(500).json({ error: "Failed to process message." });
  }
};

export const getUserChats = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const chats = await ChatbotHistory.find({ userId })
      .sort({ updatedAt: -1 })
      .select("chatId title updatedAt");
    res.status(200).json(chats);
  } catch (error) {
    console.error("Error in getUserChats:", error);
    res.status(500).json({ error: "Failed to fetch chats." });
  }
};

export const getChatById = async (req: Request, res: Response) => {
  try {
    const { chatId } = req.params;
    const chatSession = await ChatbotHistory.findOne({ chatId });
    if (!chatSession) {
      return res.status(404).json({ error: "Chat not found." });
    }
    res.status(200).json(chatSession);
  } catch (error) {
    console.error("Error in getChatById:", error);
    res.status(500).json({ error: "Failed to fetch chat." });
  }
};