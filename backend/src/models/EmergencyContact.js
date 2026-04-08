import mongoose from "mongoose";
import { timestampedOptions } from "./BaseSchemas.js";

const emergencyContactSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true },
    relation: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    whatsappNumber: String,
    isPrimary: { type: Boolean, default: false }
  },
  timestampedOptions
);

export const EmergencyContact = mongoose.model("EmergencyContact", emergencyContactSchema);
