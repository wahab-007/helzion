import twilio from "twilio";
import nodemailer from "nodemailer";
import { Notification } from "../models/index.js";
import { getSetting } from "./settings.service.js";

const buildTwilioClient = async () => {
  const notifications = await getSetting("notifications");
  const sid = notifications?.twilio?.accountSid;
  const token = notifications?.twilio?.authToken;
  if (!sid || !token) return null;
  return twilio(sid, token);
};

const buildMailTransport = async () => {
  const email = await getSetting("email");
  if (!email?.host || !email?.username || !email?.password || email?.status !== "active") return null;
  return nodemailer.createTransport({
    host: email.host,
    port: Number(email.port || 587),
    secure: String(email.encryption || "TLS").toLowerCase() === "ssl",
    auth: { user: email.username, pass: email.password }
  });
};

export const sendSms = async ({ recipient, message, user, helmet }) => {
  const notifications = await getSetting("notifications");
  const client = await buildTwilioClient();
  const log = await Notification.create({ channel: "sms", recipient, message, user, helmet });
  if (!notifications?.smsEnabled || !client || !notifications?.twilio?.smsFrom) {
    log.status = "failed";
    log.providerResponse = { reason: "SMS not configured" };
    await log.save();
    return log;
  }
  const response = await client.messages.create({ body: message, from: notifications.twilio.smsFrom, to: recipient });
  log.status = "sent";
  log.providerResponse = response;
  await log.save();
  return log;
};

export const sendWhatsApp = async ({ recipient, message, user, helmet }) => {
  const notifications = await getSetting("notifications");
  const client = await buildTwilioClient();
  const log = await Notification.create({ channel: "whatsapp", recipient, message, user, helmet });
  if (!notifications?.whatsappEnabled || !client || !notifications?.twilio?.whatsappFrom) {
    log.status = "failed";
    log.providerResponse = { reason: "WhatsApp not configured" };
    await log.save();
    return log;
  }
  const response = await client.messages.create({ body: message, from: notifications.twilio.whatsappFrom, to: `whatsapp:${recipient}` });
  log.status = "sent";
  log.providerResponse = response;
  await log.save();
  return log;
};

export const sendEmail = async ({ recipient, subject, message, user, helmet }) => {
  const notifications = await getSetting("notifications");
  const email = await getSetting("email");
  const transporter = await buildMailTransport();
  const log = await Notification.create({ channel: "email", recipient, message, user, helmet });
  if (!notifications?.emailEnabled || !transporter) {
    log.status = "failed";
    log.providerResponse = { reason: "Email not configured" };
    await log.save();
    return log;
  }
  const response = await transporter.sendMail({
    from: `${email.fromName || "SmartHelmet"} <${email.fromEmail || email.username}>`,
    to: recipient,
    subject,
    text: message
  });
  log.status = "sent";
  log.providerResponse = response;
  await log.save();
  return log;
};
