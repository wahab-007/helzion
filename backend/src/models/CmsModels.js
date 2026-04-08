import mongoose from "mongoose";
import { timestampedOptions } from "./BaseSchemas.js";

export const HomepageContent = mongoose.model(
  "HomepageContent",
  new mongoose.Schema(
    {
      heroTitle: String,
      heroSubtitle: String,
      sections: mongoose.Schema.Types.Mixed
    },
    timestampedOptions
  )
);

export const Banner = mongoose.model(
  "Banner",
  new mongoose.Schema(
    {
      title: String,
      imageUrl: String,
      targetUrl: String,
      active: { type: Boolean, default: true }
    },
    timestampedOptions
  )
);

export const InnerBanner = mongoose.model(
  "InnerBanner",
  new mongoose.Schema(
    {
      title: String,
      slug: { type: String, unique: true },
      subtitle: String,
      imageUrl: String,
      active: { type: Boolean, default: true }
    },
    timestampedOptions
  )
);

export const Faq = mongoose.model(
  "Faq",
  new mongoose.Schema(
    {
      question: String,
      answer: String,
      order: { type: Number, default: 0 },
      active: { type: Boolean, default: true }
    },
    timestampedOptions
  )
);

export const BlogPost = mongoose.model(
  "BlogPost",
  new mongoose.Schema(
    {
      title: String,
      slug: { type: String, unique: true },
      excerpt: String,
      content: String,
      coverImageUrl: String,
      published: { type: Boolean, default: false },
      tags: { type: [String], default: [] }
    },
    timestampedOptions
  )
);

export const SupportTicket = mongoose.model(
  "SupportTicket",
  new mongoose.Schema(
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      subject: String,
      message: String,
      status: { type: String, enum: ["open", "in_progress", "closed"], default: "open" }
    },
    timestampedOptions
  )
);

export const ContactUsMessage = mongoose.model(
  "ContactUsMessage",
  new mongoose.Schema(
    {
      name: String,
      email: String,
      phoneNumber: String,
      subject: String,
      message: String
    },
    timestampedOptions
  )
);
