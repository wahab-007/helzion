import mongoose from "mongoose";
import { timestampedOptions } from "./BaseSchemas.js";

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    helmet: { type: mongoose.Schema.Types.ObjectId, ref: "Helmet" },
    channel: { type: String, enum: ["sms", "whatsapp", "email", "push"], required: true },
    recipient: { type: String, required: true },
    message: { type: String, required: true },
    status: { type: String, enum: ["queued", "sent", "failed"], default: "queued" },
    providerResponse: mongoose.Schema.Types.Mixed
  },
  timestampedOptions
);

export const Notification = mongoose.model("Notification", notificationSchema);
