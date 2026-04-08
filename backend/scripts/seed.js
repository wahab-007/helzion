import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { seedDefaultSettings } from "../src/services/settings.service.js";
import { AccidentLog, AdminUser, DeviceSession, EmergencyContact, Helmet, HelmetStatusLog, LocationRequest, Notification, User } from "../src/models/index.js";

dotenv.config({ path: new URL("../.env", import.meta.url).pathname });

const buildMongoUri = () => {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;
  if (process.env.MONGODB_CLUSTER && process.env.MONGODB_USER && process.env.MONGODB_PASSWORD) {
    const user = encodeURIComponent(process.env.MONGODB_USER);
    const password = encodeURIComponent(process.env.MONGODB_PASSWORD);
    const database = process.env.MONGODB_DB || "smart-helmet";
    return `mongodb+srv://${user}:${password}@${process.env.MONGODB_CLUSTER}/${database}?retryWrites=true&w=majority`;
  }
  return "mongodb://127.0.0.1:27017/smart-helmet";
};

const mongoUri = buildMongoUri();
await mongoose.connect(mongoUri);
await seedDefaultSettings();

const adminPasswordHash = await bcrypt.hash("78678600", 12);
await AdminUser.findOneAndUpdate(
  { email: "admin@helzion.com" },
  { name: "System Admin", email: "admin@helzion.com", passwordHash: adminPasswordHash, permissions: ["*"], isActive: true },
  { upsert: true, new: true }
);
await AdminUser.deleteOne({ email: "admin@smarthelmet.com" });

const demoUsers = await User.find({ email: { $in: ["ahmed@example.com"] } }).select("_id");
const demoUserIds = demoUsers.map((item) => item._id);
const demoHelmets = await Helmet.find({ espId: { $in: ["ESP-SAMPLE-001", "ESP-LIVE-001"] } }).select("_id");
const demoHelmetIds = demoHelmets.map((item) => item._id);

if (demoUserIds.length) {
  await Promise.all([
    EmergencyContact.deleteMany({ user: { $in: demoUserIds } }),
    AccidentLog.deleteMany({ user: { $in: demoUserIds } }),
    Notification.deleteMany({ user: { $in: demoUserIds } }),
    LocationRequest.deleteMany({ user: { $in: demoUserIds } }),
    User.deleteMany({ _id: { $in: demoUserIds } })
  ]);
}

if (demoHelmetIds.length) {
  await Promise.all([
    HelmetStatusLog.deleteMany({ helmet: { $in: demoHelmetIds } }),
    AccidentLog.deleteMany({ helmet: { $in: demoHelmetIds } }),
    Notification.deleteMany({ helmet: { $in: demoHelmetIds } }),
    DeviceSession.deleteMany({ helmet: { $in: demoHelmetIds } }),
    LocationRequest.deleteMany({ helmet: { $in: demoHelmetIds } }),
    Helmet.deleteMany({ _id: { $in: demoHelmetIds } })
  ]);
}

console.log("Seed complete");
console.log(`Admin login: admin@helzion.com / 78678600`);
console.log("Demo users, demo helmets, and demo telemetry removed.");

await mongoose.disconnect();
