import { DeviceSession } from "../models/index.js";

export const requireDeviceToken = async (req, res, next) => {
  const token = req.headers["x-device-token"];
  if (!token) {
    return res.status(401).json({ message: "Missing device token" });
  }

  const session = await DeviceSession.findOne({ token }).populate("helmet");
  if (!session || session.expiresAt < new Date()) {
    return res.status(401).json({ message: "Invalid device token" });
  }

  session.lastSeenAt = new Date();
  await session.save();
  req.deviceSession = session;
  next();
};
