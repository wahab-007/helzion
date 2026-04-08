import mongoose from "mongoose";
import { timestampedOptions } from "./BaseSchemas.js";

const adminUserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    permissions: { type: [String], default: ["*"] },
    isActive: { type: Boolean, default: true }
  },
  timestampedOptions
);

export const AdminUser = mongoose.model("AdminUser", adminUserSchema);
