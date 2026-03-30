import { Request, Response } from "express";
import { ChatbotHistory } from "../models/chatbot.model";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { v4 as uuidv4 } from "uuid";
import mongoose from "mongoose";

const geminiApiKey = process.env.GEMINI_API_KEY;
if (!geminiApiKey) {
  throw new Error("GEMINI_API_KEY is required for chatbot Gemini integration.");
}

const genAI = new GoogleGenerativeAI(geminiApiKey);

const DEFAULT_EVENT_DATABASE = process.env.EVENTS_DATABASE_NAME?.trim();
const DEFAULT_EVENT_COLLECTION = process.env.EVENTS_COLLECTION_NAME || "events";
const DEFAULT_EVENT_LIMIT = Number(process.env.CHATBOT_EVENT_DATA_LIMIT || 50);

function getEventDataLimit() {
  if (Number.isFinite(DEFAULT_EVENT_LIMIT) && DEFAULT_EVENT_LIMIT > 0) {
    return Math.min(DEFAULT_EVENT_LIMIT, 200);
  }
  return 50;
}

async function getLatestEventData() {
  try {
    const connection = mongoose.connection;
    if (!connection.db) {
      console.warn("MongoDB connection is not ready. Skipping event data fetching.");
      return [];
    }

    const db = DEFAULT_EVENT_DATABASE
      ? connection.getClient().db(DEFAULT_EVENT_DATABASE)
      : connection.db;

    const limit = getEventDataLimit();
    const collection = db.collection(DEFAULT_EVENT_COLLECTION);

    const docs = await collection
      .find({})
      .sort({ updatedAt: -1, createdAt: -1, _id: -1 })
      .limit(limit)
      .toArray();

    return docs;
  } catch (error) {
    console.error("Failed to fetch latest event data (likely due to cross-database permissions):", error);
    return []; // Return empty array if fetching fails so the chatbot can still work
  }
}

export const sendMessage = async (req: Request, res: Response) => {
  try {
    const { userId, chatId, message } = req.body;
    
    // 1. Initial health check for DB
    if (mongoose.connection.readyState !== 1) {
      console.error("Database not connected in sendMessage");
      return res.status(503).json({ error: "Service temporarily unavailable: Database connection lost." });
    }

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

    // 2. Save User Message FIRST
    chatSession.messages.push({
      sender: "user",
      text: message,
      timestamp: new Date(),
    });
    
    await chatSession.save();

    // 3. Prepare AI Prompt
    const formattedHistory = chatSession.messages.slice(0, -1).map((msg) => ({
      role: msg.sender === "bot" ? "model" : "user",
      parts: [{ text: msg.text }],
    }));

    const latestEventData = await getLatestEventData();
    const eventDataString = latestEventData.length > 0 
      ? JSON.stringify(latestEventData, null, 2)
      : "No previous event data available at the moment.";

    const systemPrompt = `
      You are an AI assistant for EventZen, a premium event planning platform. 
      Your primary role is to help users plan events, manage budgets, and answer questions based on our previous event data.

      Here is the latest event data from our platform for your reference:
      ${eventDataString}

      STRICT INSTRUCTIONS:
      - Answer ONLY event planning, EventZen, or budget related questions.
      - Decline unrelated queries with: "I'm sorry, but I am an event planning assistant for EventZen. I can only help you with questions related to organizing events, our platform services, or our past event portfolios. How can I help you plan your next event?"
    `;

    // 4. Call Gemini with Fallback
    const modelNames = ["gemini-1.5-flash", "gemini-1.5-flash-latest", "gemini-pro"];
    let botResponseText = "";
    let lastError = null;

    for (const modelName of modelNames) {
      try {
        console.log(`Attempting to use Gemini model: ${modelName}`);
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: systemPrompt,
        });

        const chat = model.startChat({
          history: formattedHistory,
        });

        const result = await chat.sendMessage(message);
        botResponseText = result.response.text();
        
        if (botResponseText) {
          console.log(`Successfully used model: ${modelName}`);
          break; 
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`Model ${modelName} failed choice:`, err.message);
        continue;
      }
    }

    if (!botResponseText && lastError) {
      throw lastError; 
    }

    // 5. Save Bot Response
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
  } catch (error: any) {
    console.error("DETAILED CHATBOT ERROR:", {
      message: error.message,
      stack: error.stack,
      code: error.code || "No error code"
    });
    
    res.status(500).json({ 
      error: "Failed to process message.",
      message: error.message,
      code: error.code,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined
    });
  }
};

export const getUserChats = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ error: "UserId is required." });
    }
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
