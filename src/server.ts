import "dotenv/config";
import { createApp } from "./app";
import { connectDB } from "./config/db";

const port = Number(process.env.PORT || 5009);

async function start() {
  await connectDB();
  createApp().listen(port, () => {
    console.log(`reporting-service on ${port}`);
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});