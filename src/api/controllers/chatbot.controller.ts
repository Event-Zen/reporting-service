import { Request, Response } from "express";
import { ChatbotHistory } from "../models/chatbot.model";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";

const geminiApiKey = process.env.GEMINI_API_KEY;
if (!geminiApiKey) {
  throw new Error("GEMINI_API_KEY is required for chatbot Gemini integration.");
}

const genAI = new GoogleGenerativeAI(geminiApiKey);

const dataFilePath = path.join(__dirname, "../data/data.json");
const previousEventsData = JSON.parse(fs.readFileSync(dataFilePath, "utf-8"));

export const sendMessage = async (req: Request, res: Response) => {
  try {
    const { userId, chatId, message } = req.body;
    let currentChatId = chatId;
    let chatSession = null;

    if (currentChatId) {
      chatSession = await ChatbotHistory.findOne({
        chatId: currentChatId,
        userId,
      });
    }

    if (!chatSession) {
      currentChatId = uuidv4();
      const title =
        message.length > 30 ? message.substring(0, 30) + "..." : message;
      chatSession = new ChatbotHistory({
        chatId: currentChatId,
        userId,
        title,
        messages: [],
      });
    }

    chatSession.messages.push({
      sender: "user",
      text: message,
      timestamp: new Date(),
    });

    const formattedHistory = chatSession.messages.slice(0, -1).map((msg) => ({
      role: msg.sender === "bot" ? "model" : "user",
      parts: [{ text: msg.text }],
    }));

    const eventDataString = JSON.stringify(previousEventsData, null, 2);

    const systemPrompt = `
      You are an AI assistant for EventZen, a premium event planning platform. 
      Your primary role is to help users plan events, manage budgets, and answer questions based on our previous event data.

      Here is the data of our previous successful events for your reference:
      ${eventDataString}

      STRICT INSTRUCTIONS AND BOUNDARIES:
      - You MUST ONLY answer questions related to event planning, the EventZen platform, event services, budgeting, or the previous events data provided above.
      - If a user asks a question completely unrelated to events or EventZen (for example: coding help, general history, weather, politics, or math), you MUST decline to answer.
      - When declining an unrelated request, use this exact fallback message: "I'm sorry, but I am an event planning assistant for EventZen. I can only help you with questions related to organizing events, our platform services, or our past event portfolios. How can I help you plan your next event?"
      - Always maintain a polite, helpful, and professional tone.
    `;

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: systemPrompt,
    });

    const chat = model.startChat({
      history: formattedHistory,
    });

    const result = await chat.sendMessage(message);
    const botResponseText = result.response.text();

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
