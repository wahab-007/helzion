import mongoose from "mongoose";
import { locationSchema, timestampedOptions } from "./BaseSchemas.js";

const locationRequestSchema = new mongoose.Schema(
  {
    helmet: { type: mongoose.Schema.Types.ObjectId, ref: "Helmet", required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    requestedByType: {
      type: String,
      enum: ["user", "admin", "contact", "system"],
      required: true
    },
    requestedByUser: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    contact: { type: mongoose.Schema.Types.ObjectId, ref: "EmergencyContact" },
    sourceChannel: {
      type: String,
      enum: ["web", "mobile", "admin", "whatsapp", "sms", "system"],
      default: "web"
    },
    status: {
      type: String,
      enum: ["pending", "delivered", "acknowledged", "responded", "expired", "failed"],
      default: "pending",
      index: true
    },
    reason: String,
    message: String,
    requestToken: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, required: true, index: true },
    respondedAt: Date,
    deliveredAt: Date,
    lastKnownLocation: locationSchema,
    responseMetadata: mongoose.Schema.Types.Mixed
  },
  timestampedOptions
);

export const LocationRequest = mongoose.model("LocationRequest", locationRequestSchema);
