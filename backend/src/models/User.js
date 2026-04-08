import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { timestampedOptions } from "./BaseSchemas.js";

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    cnicNumber: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phoneNumber: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
    roles: { type: [String], default: ["user"] },
    emailVerifiedAt: Date,
    phoneVerifiedAt: Date,
    isActive: { type: Boolean, default: true },
    defaultHelmet: { type: mongoose.Schema.Types.ObjectId, ref: "Helmet" }
  },
  timestampedOptions
);

userSchema.methods.comparePassword = function comparePassword(password) {
  return bcrypt.compare(password, this.passwordHash);
};

export const User = mongoose.model("User", userSchema);
