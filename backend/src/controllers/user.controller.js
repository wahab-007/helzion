import { EmergencyContact, Helmet, HelmetStatusLog, AccidentLog, Notification, User } from "../models/index.js";

export const me = async (req, res) => {
  const user = await User.findById(req.auth.sub).select("fullName email phoneNumber cnicNumber roles defaultHelmet");
  res.json(user);
};

export const updateMe = async (req, res) => {
  const { fullName, email, phoneNumber, cnicNumber } = req.body;
  const user = await User.findByIdAndUpdate(
    req.auth.sub,
    { fullName, email, phoneNumber, cnicNumber },
    { new: true }
  ).select("fullName email phoneNumber cnicNumber roles defaultHelmet");
  res.json(user);
};

export const helmetOverview = async (req, res) => res.json(await Helmet.find({ user: req.auth.sub }));

export const emergencyContacts = async (req, res) => {
  if (req.method === "GET") return res.json(await EmergencyContact.find({ user: req.auth.sub }));
  const count = await EmergencyContact.countDocuments({ user: req.auth.sub });
  if (count >= 5) return res.status(400).json({ message: "Maximum five contacts allowed" });
  const contact = await EmergencyContact.create({ ...req.body, user: req.auth.sub });
  res.status(201).json(contact);
};

export const updateEmergencyContact = async (req, res) => {
  const contact = await EmergencyContact.findOneAndUpdate(
    { _id: req.params.contactId, user: req.auth.sub },
    req.body,
    { new: true }
  );
  if (!contact) return res.status(404).json({ message: "Contact not found" });
  res.json(contact);
};

export const deleteEmergencyContact = async (req, res) => {
  const contact = await EmergencyContact.findOneAndDelete({ _id: req.params.contactId, user: req.auth.sub });
  if (!contact) return res.status(404).json({ message: "Contact not found" });
  res.json({ success: true });
};

export const accidentHistory = async (req, res) => res.json(await AccidentLog.find({ user: req.auth.sub }).sort({ createdAt: -1 }));
export const notifications = async (req, res) => res.json(await Notification.find({ user: req.auth.sub }).sort({ createdAt: -1 }).limit(20));

export const liveStatus = async (req, res) => {
  const helmet = await Helmet.findOne({ user: req.auth.sub }).sort({ createdAt: -1 });
  if (!helmet) return res.status(404).json({ message: "Helmet not found" });
  const status = await HelmetStatusLog.findOne({ helmet: helmet._id }).sort({ createdAt: -1 });
  res.json({ helmet, status, ridingMode: helmet.ridingModeActive });
};
