import { authenticateDevice, getDeviceSettingsSnapshot, storeHelmetStatus } from "../services/device.service.js";
import { dispatchEmergencyAlert } from "../services/accident.service.js";
import { AccidentLog } from "../models/index.js";

export const loginDevice = async (req, res) => {
  const result = await authenticateDevice(req.body);
  if (!result) return res.status(401).json({ message: "Device authentication failed" });

  res.json({
    helmet: {
      id: result.helmet._id,
      helmetId: result.helmet.espId,
      espId: result.helmet.espId,
      firmwareVersion: result.helmet.firmwareVersion,
      bluetoothEnabled: result.helmet.bluetoothEnabled
    },
    deviceToken: result.session.token,
    settings: result.settings
  });
};

export const getDeviceSettings = async (_req, res) => {
  res.json(await getDeviceSettingsSnapshot());
};

export const pushStatus = async (req, res) => {
  await storeHelmetStatus(req.deviceSession.helmet._id, req.body);
  res.json({ ok: true });
};

export const sendAccident = async (req, res) => {
  const log = await dispatchEmergencyAlert({ helmetId: req.deviceSession.helmet._id, ...req.body });
  res.status(201).json(log);
};

export const cancelAccident = async (req, res) => {
  const log = await AccidentLog.findByIdAndUpdate(
    req.params.id,
    { canceled: true, responseStatus: "canceled" },
    { new: true }
  );
  res.json(log);
};
