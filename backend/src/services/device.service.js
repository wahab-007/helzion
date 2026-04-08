import crypto from "crypto";
import { DeviceSession, Helmet, HelmetStatusLog } from "../models/index.js";
import { publishHelmetStatusUpdate } from "./realtime.service.js";
import { getSettingsMap } from "./settings.service.js";

export const authenticateDevice = async ({ espId, helmetId, secretKey }) => {
  const resolvedHelmetId = helmetId || espId;
  const helmet = await Helmet.findOne({ espId: resolvedHelmetId });
  if (!helmet || helmet.secretKey !== secretKey || !helmet.isActive || helmet.isBlacklisted) {
    return null;
  }

  await DeviceSession.deleteMany({ helmet: helmet._id });
  const token = crypto.randomBytes(24).toString("hex");
  const session = await DeviceSession.create({
    helmet: helmet._id,
    token,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    lastSeenAt: new Date()
  });

  return { helmet, session, settings: await getSettingsMap() };
};

export const getDeviceSettingsSnapshot = async () => ({
  settings: await getSettingsMap(),
  fetchedAt: new Date().toISOString()
});

export const storeHelmetStatus = async (helmetId, payload) => {
  const ridingMode = Boolean(payload.ridingMode);
  const helmet = await Helmet.findByIdAndUpdate(
    helmetId,
    {
      $set: {
        ridingModeActive: ridingMode,
        lastRidingModeAt: ridingMode ? new Date() : undefined,
        firmwareVersion: payload.firmwareVersion
      }
    },
    { new: true }
  );

  const status = await HelmetStatusLog.create({
    helmet: helmetId,
    ...payload,
    ridingMode,
    ridingModeStartedAt: ridingMode ? new Date() : undefined
  });

  publishHelmetStatusUpdate({ helmet, status });
  return { helmet, status };
};
