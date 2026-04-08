import { defaultSettings } from "../config/default-settings.js";
import { Setting } from "../models/index.js";

export const seedDefaultSettings = async () => {
  for (const item of defaultSettings) {
    await Setting.updateOne(
      { key: item.key },
      { $setOnInsert: item },
      { upsert: true }
    );
  }
};

export const getSettingsMap = async () => {
  const settings = await Setting.find().lean();
  return settings.reduce((acc, item) => {
    acc[item.key] = item.value;
    return acc;
  }, {});
};

export const getSetting = async (key) => {
  const setting = await Setting.findOne({ key }).lean();
  return setting?.value || null;
};
