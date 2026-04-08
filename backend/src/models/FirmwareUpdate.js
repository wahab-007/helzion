import mongoose from "mongoose";
import { timestampedOptions } from "./BaseSchemas.js";

const firmwareUpdateSchema = new mongoose.Schema(
  {
    version: { type: String, required: true },
    releaseNotes: String,
    otaUrl: { type: String, required: true },
    minBatteryPercentage: { type: Number, default: 40 },
    rolloutStatus: { type: String, enum: ["draft", "active", "paused"], default: "draft" }
  },
  timestampedOptions
);

export const FirmwareUpdate = mongoose.model("FirmwareUpdate", firmwareUpdateSchema);
