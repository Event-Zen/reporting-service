import "dotenv/config";
import { createApp } from "./app";

const port = Number(process.env.PORT || 4001);

createApp().listen(port, () => {
  console.log(`reporting-service running on http://localhost:${port}`);
});