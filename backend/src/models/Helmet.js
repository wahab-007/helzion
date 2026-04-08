import mongoose from "mongoose";
import { timestampedOptions } from "./BaseSchemas.js";

const helmetSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    label: String,
    espId: { type: String, required: true, unique: true, index: true },
    secretKey: { type: String, required: true },
    serialNumber: String,
    firmwareVersion: String,
    isAssigned: { type: Boolean, default: false },
    isActive: { type: Boolean, default: false },
    isBlacklisted: { type: Boolean, default: false },
    ridingModeActive: { type: Boolean, default: false },
    lastRidingModeAt: Date,
    lastKnownIp: String,
    bluetoothEnabled: { type: Boolean, default: true }
  },
  timestampedOptions
);

export const Helmet = mongoose.model("Helmet", helmetSchema);
