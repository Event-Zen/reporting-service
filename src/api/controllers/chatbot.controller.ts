import { Request, Response } from "express";
import { ChatbotHistory } from "../models/chatbot.model";
import { v4 as uuidv4 } from "uuid";

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
      chatSession = new ChatbotHistory({
        chatId: currentChatId,
        userId,
        title,
        messages: [],
      });
    }

    // Save User Message
    chatSession.messages.push({
      sender: "user",
      text: message,
      timestamp: new Date(),
    });

    // Placeholder Bot Response (Before Gemini)
    const botResponseText = "This is a placeholder response. Gemini is not connected yet.";

    chatSession.messages.push({
      sender: "bot",
      text: botResponseText,
      timestamp: new Date(),
    });
    
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