import mongoose from "mongoose";

export const timestampedOptions = {
  timestamps: true
};

export const locationSchema = new mongoose.Schema(
  {
    lat: Number,
    lng: Number,
    source: {
      type: String,
      enum: ["gps", "google_geolocation", "manual", "unknown"],
      default: "unknown"
    },
    accuracyMeters: Number,
    mapUrl: String
  },
  { _id: false }
);
