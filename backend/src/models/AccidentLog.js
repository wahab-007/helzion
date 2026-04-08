import mongoose from "mongoose";
import { locationSchema, timestampedOptions } from "./BaseSchemas.js";

const accidentLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    helmet: { type: mongoose.Schema.Types.ObjectId, ref: "Helmet" },
    helmetId: String,
    type: { type: String, enum: ["impact", "manual_sos", "false_alarm"], required: true },
    severity: { type: String, enum: ["low", "medium", "severe"], default: "low" },
    location: locationSchema,
    responseStatus: {
      type: String,
      enum: ["pending", "sent", "canceled", "failed"],
      default: "pending"
    },
    canceled: { type: Boolean, default: false },
    batteryPercentage: Number,
    metadata: mongoose.Schema.Types.Mixed
  },
  timestampedOptions
);

export const AccidentLog = mongoose.model("AccidentLog", accidentLogSchema);
