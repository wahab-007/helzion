import bcrypt from "bcryptjs";
import { z } from "zod";
import { AdminUser, ContactUsMessage, EmergencyContact, Helmet, User } from "../models/index.js";
import { signAccessToken, signRefreshToken } from "../utils/jwt.js";

const emergencyContactSchema = z.object({
  name: z.string().min(2),
  relation: z.string().min(2),
  phoneNumber: z.string().min(8),
  whatsappNumber: z.string().optional().default("")
});

const registerSchema = z.object({
  fullName: z.string().min(2),
  cnicNumber: z.string().min(5),
  email: z.string().email(),
  phoneNumber: z.string().min(8),
  password: z.string().min(8),
  helmetId: z.string().min(2).optional(),
  helmetEspId: z.string().min(2).optional(),
  secretKey: z.string().min(2),
  emergencyContacts: z.array(emergencyContactSchema).max(5).optional().default([])
}).refine((value) => value.helmetId || value.helmetEspId, {
  message: "Helmet ID is required",
  path: ["helmetId"]
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

const contactSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phoneNumber: z.string().optional().default(""),
  subject: z.string().min(2),
  message: z.string().min(10)
});

const signActorTokens = (actor) => {
  const payload = { sub: actor._id, roles: actor.roles || ["admin"], actorType: actor.roles ? "user" : "admin" };
  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload)
  };
};

export const register = async (req, res) => {
  const payload = registerSchema.parse(req.body);
  const helmetId = payload.helmetId || payload.helmetEspId;
  const helmet = await Helmet.findOne({ espId: helmetId, secretKey: payload.secretKey });
  if (!helmet || helmet.isAssigned) {
    return res.status(400).json({ message: "Invalid or already assigned helmet" });
  }

  const passwordHash = await bcrypt.hash(payload.password, 12);
  const user = await User.create({
    fullName: payload.fullName,
    cnicNumber: payload.cnicNumber,
    email: payload.email,
    phoneNumber: payload.phoneNumber,
    passwordHash,
    defaultHelmet: helmet._id
  });

  if (payload.emergencyContacts.length) {
    await EmergencyContact.insertMany(
      payload.emergencyContacts.map((contact, index) => ({
        ...contact,
        user: user._id,
        isPrimary: index === 0
      }))
    );
  }

  helmet.user = user._id;
  helmet.isAssigned = true;
  helmet.isActive = true;
  await helmet.save();

  res.status(201).json({ user, ...signActorTokens(user) });
};

export const login = async (req, res) => {
  const payload = loginSchema.parse(req.body);
  const user = await User.findOne({ email: payload.email });
  if (!user || !(await user.comparePassword(payload.password))) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  res.json({ user, ...signActorTokens(user) });
};

export const adminLogin = async (req, res) => {
  const payload = loginSchema.parse(req.body);
  const admin = await AdminUser.findOne({ email: payload.email });
  if (!admin || !(await bcrypt.compare(payload.password, admin.passwordHash))) {
    return res.status(401).json({ message: "Invalid admin credentials" });
  }

  res.json({
    admin,
    accessToken: signAccessToken({ sub: admin._id, roles: ["admin"], actorType: "admin" }),
    refreshToken: signRefreshToken({ sub: admin._id, roles: ["admin"], actorType: "admin" })
  });
};

export const submitContactMessage = async (req, res) => {
  const payload = contactSchema.parse(req.body);
  const message = await ContactUsMessage.create(payload);
  res.status(201).json({ message: "Message submitted successfully", item: message });
};
