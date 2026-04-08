import { AccidentLog, EmergencyContact, Helmet, User } from "../models/index.js";
import { sendEmail, sendSms, sendWhatsApp } from "./notification.service.js";

const buildMapsUrl = (lat, lng) => `https://maps.google.com/?q=${lat},${lng}`;

export const dispatchEmergencyAlert = async ({ helmetId, type, severity, location, batteryPercentage, metadata }) => {
  const helmet = await Helmet.findById(helmetId).populate("user");
  if (!helmet?.user) throw new Error("Helmet user not found");
  const user = await User.findById(helmet.user._id);
  const contacts = await EmergencyContact.find({ user: user._id }).limit(5);
  const mapUrl = buildMapsUrl(location.lat, location.lng);
  const log = await AccidentLog.create({
    user: user._id,
    helmet: helmet._id,
    helmetId: helmet.espId,
    type,
    severity,
    location: { ...location, mapUrl },
    responseStatus: "pending",
    batteryPercentage,
    metadata
  });
  const message = `Emergency Alert: ${user.fullName} may have been involved in an accident. Last known location: ${mapUrl} Time: ${new Date().toISOString()} Helmet ID: ${helmet.espId} Battery: ${batteryPercentage}%`;
  for (const contact of contacts) {
    await sendSms({ recipient: contact.phoneNumber, message, user: user._id, helmet: helmet._id });
    if (contact.whatsappNumber) {
      await sendWhatsApp({ recipient: contact.whatsappNumber, message, user: user._id, helmet: helmet._id });
    }
  }
  await sendEmail({ recipient: user.email, subject: "Smart Helmet Emergency Alert", message, user: user._id, helmet: helmet._id });
  log.responseStatus = "sent";
  await log.save();
  return log;
};
