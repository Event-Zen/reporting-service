import express from "express";
import {
  sendMessage,
  getUserChats,
  getChatById,
} from "../controllers/chatbot.controller";

const router = express.Router();

router.post("/send", sendMessage);
router.get("/user/:userId", getUserChats);
router.get("/chat/:chatId", getChatById);

export default router;