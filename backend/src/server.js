import dotenv from "dotenv";
import mongoose from "mongoose";
import { createApp } from "./app.js";
import { createRealtimeServer } from "./services/realtime.service.js";
import { seedDefaultSettings } from "./services/settings.service.js";

dotenv.config();

const port = Number(process.env.PORT || 5000);
const buildMongoUri = () => {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;
  if (process.env.MONGODB_CLUSTER && process.env.MONGODB_USER && process.env.MONGODB_PASSWORD) {
    const user = encodeURIComponent(process.env.MONGODB_USER);
    const password = encodeURIComponent(process.env.MONGODB_PASSWORD);
    const database = process.env.MONGODB_DB || "smart-helmet";
    return `mongodb+srv://${user}:${password}@${process.env.MONGODB_CLUSTER}/${database}?retryWrites=true&w=majority`;
  }
  return "";
};
const mongoUri = buildMongoUri();

if (!mongoUri) {
  throw new Error("MongoDB configuration is incomplete. Set MONGODB_URI or provide MONGODB_CLUSTER, MONGODB_USER, and MONGODB_PASSWORD.");
}

await mongoose.connect(mongoUri);
await seedDefaultSettings();

const app = createApp();
const server = createRealtimeServer(app);

server.listen(port, () => {
  console.log(`API and realtime server listening on ${port}`);
});
