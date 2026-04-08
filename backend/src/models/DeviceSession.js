import mongoose from "mongoose";
import { timestampedOptions } from "./BaseSchemas.js";

const deviceSessionSchema = new mongoose.Schema(
  {
    helmet: { type: mongoose.Schema.Types.ObjectId, ref: "Helmet", required: true },
    token: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    lastSeenAt: Date
  },
  timestampedOptions
);

export const DeviceSession = mongoose.model("DeviceSession", deviceSessionSchema);
