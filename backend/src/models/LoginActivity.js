import mongoose from "mongoose";
import { timestampedOptions } from "./BaseSchemas.js";

const loginActivitySchema = new mongoose.Schema(
  {
    actorType: { type: String, enum: ["user", "admin"], required: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, required: true },
    ip: String,
    userAgent: String,
    success: Boolean
  },
  timestampedOptions
);

export const LoginActivity = mongoose.model("LoginActivity", loginActivitySchema);
