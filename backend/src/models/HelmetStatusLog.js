import mongoose from "mongoose";
import { timestampedOptions } from "./BaseSchemas.js";

const helmetStatusLogSchema = new mongoose.Schema(
  {
    helmet: { type: mongoose.Schema.Types.ObjectId, ref: "Helmet", required: true },
    online: Boolean,
    batteryPercentage: Number,
    firmwareVersion: String,
    gpsSignal: Boolean,
    wifiStrength: Number,
    helmetWorn: Boolean,
    ridingMode: { type: Boolean, default: false },
    ridingModeStartedAt: Date,
    sensors: mongoose.Schema.Types.Mixed
  },
  timestampedOptions
);

export const HelmetStatusLog = mongoose.model("HelmetStatusLog", helmetStatusLogSchema);
