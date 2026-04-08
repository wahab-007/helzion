import bcrypt from "bcryptjs";
import { z } from "zod";
import { AccidentLog, AdminUser, Banner, BlogPost, ContactUsMessage, Faq, Helmet, HelmetStatusLog, HomepageContent, InnerBanner, Setting, SupportTicket, User } from "../models/index.js";

const createHelmetSchema = z.object({ helmetId: z.string().min(3).optional(), espId: z.string().min(3).optional(), secretKey: z.string().min(6), label: z.string().optional(), serialNumber: z.string().optional(), firmwareVersion: z.string().optional(), user: z.string().optional().nullable() })
  .refine((value) => value.helmetId || value.espId, { message: "Helmet ID is required", path: ["helmetId"] });
const updateHelmetSchema = z.object({ label: z.string().optional(), serialNumber: z.string().optional(), firmwareVersion: z.string().optional(), isActive: z.boolean().optional(), isBlacklisted: z.boolean().optional(), bluetoothEnabled: z.boolean().optional(), user: z.string().optional().nullable() });
const createUserSchema = z.object({ fullName: z.string().min(2), cnicNumber: z.string().min(5), email: z.string().email(), phoneNumber: z.string().min(8), password: z.string().min(8) });
const updateUserSchema = z.object({ fullName: z.string().min(2).optional(), cnicNumber: z.string().min(5).optional(), email: z.string().email().optional(), phoneNumber: z.string().min(8).optional(), isActive: z.boolean().optional() });
const updateIncidentSchema = z.object({ responseStatus: z.enum(["pending", "sent", "canceled", "failed"]).optional(), severity: z.enum(["low", "medium", "severe"]).optional(), canceled: z.boolean().optional() });
const bannerSchema = z.object({ title: z.string().min(2), imageUrl: z.string().default(""), targetUrl: z.string().default("/"), active: z.boolean().default(true) });
const innerBannerSchema = z.object({ title: z.string().min(2), slug: z.string().min(2), subtitle: z.string().default(""), imageUrl: z.string().default(""), active: z.boolean().default(true) });
const faqSchema = z.object({ question: z.string().min(5), answer: z.string().min(5), order: z.number().optional().default(0), active: z.boolean().optional().default(true) });
const blogSchema = z.object({ title: z.string().min(3), slug: z.string().min(2), excerpt: z.string().default(""), content: z.string().default(""), coverImageUrl: z.string().default(""), published: z.boolean().default(false), tags: z.array(z.string()).default([]) });
const passwordSchema = z.object({ oldPassword: z.string().min(8), newPassword: z.string().min(8), confirmPassword: z.string().min(8) });

const getSettingsAsMap = async () => {
  const settings = await Setting.find().sort({ key: 1 }).lean();
  return settings.reduce((acc, item) => {
    acc[item.key] = item.value;
    return acc;
  }, {});
};

const getHelmetStatusMaps = async () => {
  const [statusLogs, latestIncidents] = await Promise.all([
    HelmetStatusLog.aggregate([{ $sort: { createdAt: -1 } }, { $group: { _id: "$helmet", doc: { $first: "$$ROOT" } } }]),
    AccidentLog.aggregate([{ $sort: { createdAt: -1 } }, { $group: { _id: "$helmet", doc: { $first: "$$ROOT" } } }])
  ]);
  return {
    statusMap: new Map(statusLogs.map((item) => [String(item._id), item.doc])),
    incidentMap: new Map(latestIncidents.map((item) => [String(item._id), item.doc]))
  };
};

export const dashboard = async (_req, res) => {
  const [totalUsers, totalHelmets, onlineHelmets, activeRides, recentAccidents, settings, recentUsers, banners, homepageContent, totalBlogs, totalFaqs, contactMessages] = await Promise.all([
    User.countDocuments(),
    Helmet.countDocuments(),
    Helmet.countDocuments({ isActive: true }),
    Helmet.countDocuments({ ridingModeActive: true }),
    AccidentLog.find().populate("user helmet").sort({ createdAt: -1 }).limit(10),
    Setting.find().sort({ key: 1 }),
    User.find().sort({ createdAt: -1 }).limit(5),
    Banner.find().sort({ createdAt: -1 }).limit(10),
    HomepageContent.findOne().sort({ updatedAt: -1 }),
    BlogPost.countDocuments(),
    Faq.countDocuments(),
    ContactUsMessage.countDocuments()
  ]);
  res.json({ metrics: { totalUsers, totalHelmets, onlineHelmets, activeRides, totalBlogs, totalFaqs, contactMessages }, recentAccidents, recentUsers, settings, banners, homepageContent });
};

export const createUser = async (req, res) => {
  const payload = createUserSchema.parse(req.body);
  const passwordHash = await bcrypt.hash(payload.password, 12);
  const user = await User.create({ ...payload, passwordHash, roles: ["user"], isActive: true });
  res.status(201).json(user);
};

export const updateUser = async (req, res) => {
  const payload = updateUserSchema.parse(req.body);
  const user = await User.findByIdAndUpdate(req.params.id, payload, { new: true });
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json(user);
};

export const createHelmet = async (req, res) => {
  const payload = createHelmetSchema.parse(req.body);
  const helmet = await Helmet.create({
    espId: payload.helmetId || payload.espId,
    secretKey: payload.secretKey,
    label: payload.label,
    serialNumber: payload.serialNumber,
    firmwareVersion: payload.firmwareVersion,
    user: payload.user || undefined
  });
  res.status(201).json(helmet);
};

export const updateHelmet = async (req, res) => {
  const payload = updateHelmetSchema.parse(req.body);
  const helmet = await Helmet.findByIdAndUpdate(req.params.id, payload, { new: true }).populate("user");
  if (!helmet) return res.status(404).json({ message: "Helmet not found" });
  res.json(helmet);
};

export const updateSetting = async (req, res) => {
  const { key } = req.params;
  const setting = await Setting.findOneAndUpdate({ key }, { value: req.body.value, updatedBy: req.auth.sub }, { new: true, upsert: true });
  res.json(setting);
};

export const listUsers = async (_req, res) => res.json(await User.find().sort({ createdAt: -1 }).lean());

export const listHelmets = async (_req, res) => {
  const helmets = await Helmet.find().populate("user").sort({ createdAt: -1 }).lean();
  const { statusMap, incidentMap } = await getHelmetStatusMaps();
  res.json(helmets.map((helmet) => {
    const lastStatus = statusMap.get(String(helmet._id));
    const lastIncident = incidentMap.get(String(helmet._id));
    return { ...helmet, helmetId: helmet.espId, ownerName: helmet.user?.fullName || "Unassigned", batteryPercentage: lastStatus?.batteryPercentage ?? null, online: lastStatus?.online ?? false, locationLabel: lastIncident?.location?.mapUrl ? "Karachi" : "Unknown", lastStatus };
  }));
};

export const listIncidents = async (_req, res) => res.json(await AccidentLog.find().populate("user helmet").sort({ createdAt: -1 }).limit(100).lean());

export const getIncidentDetails = async (req, res) => {
  const incident = await AccidentLog.findById(req.params.id).populate("user helmet").lean();
  if (!incident) return res.status(404).json({ message: "Incident not found" });
  const notifications = await import("../models/index.js").then((mod) => mod.Notification.find({ helmet: incident.helmet?._id }).sort({ createdAt: -1 }).limit(10).lean());
  res.json({ incident, notifications });
};

export const updateIncident = async (req, res) => {
  const payload = updateIncidentSchema.parse(req.body);
  const incident = await AccidentLog.findByIdAndUpdate(req.params.id, payload, { new: true }).populate("user helmet");
  if (!incident) return res.status(404).json({ message: "Incident not found" });
  res.json(incident);
};

export const listSettings = async (_req, res) => res.json(await Setting.find().sort({ key: 1 }));
export const getHomepageContent = async (_req, res) => res.json((await HomepageContent.findOne().sort({ updatedAt: -1 })) || {});
export const listBanners = async (_req, res) => res.json(await Banner.find().sort({ createdAt: -1 }));
export const listInnerBanners = async (_req, res) => res.json(await InnerBanner.find().sort({ createdAt: -1 }));
export const listFaqs = async (_req, res) => res.json(await Faq.find().sort({ order: 1, createdAt: -1 }));
export const listBlogs = async (_req, res) => res.json(await BlogPost.find().sort({ createdAt: -1 }));
export const listSupportTickets = async (_req, res) => res.json(await SupportTicket.find().populate("user").sort({ createdAt: -1 }));
export const listContactMessages = async (_req, res) => res.json(await ContactUsMessage.find().sort({ createdAt: -1 }));

export const getCmsBundle = async (_req, res) => {
  const [homepageContent, banners, settingsMap, faqs, innerBanners, blogs, contactMessages, supportTickets] = await Promise.all([
    HomepageContent.findOne().sort({ updatedAt: -1 }).lean(),
    Banner.find().sort({ createdAt: -1 }).lean(),
    getSettingsAsMap(),
    Faq.find().sort({ order: 1, createdAt: -1 }).lean(),
    InnerBanner.find().sort({ createdAt: -1 }).lean(),
    BlogPost.find().sort({ createdAt: -1 }).lean(),
    ContactUsMessage.find().sort({ createdAt: -1 }).lean(),
    SupportTicket.find().populate("user").sort({ createdAt: -1 }).lean()
  ]);
  res.json({ homepageContent: homepageContent || {}, banners, settings: settingsMap, faqs, innerBanners, blogs, contactMessages, supportTickets });
};

export const saveHomepageContent = async (req, res) => res.json(await HomepageContent.findOneAndUpdate({}, req.body, { new: true, upsert: true }));
export const createBanner = async (req, res) => res.status(201).json(await Banner.create(bannerSchema.parse(req.body)));
export const updateBanner = async (req, res) => res.json(await Banner.findByIdAndUpdate(req.params.id, bannerSchema.partial().parse(req.body), { new: true }));
export const createInnerBanner = async (req, res) => res.status(201).json(await InnerBanner.create(innerBannerSchema.parse(req.body)));
export const updateInnerBanner = async (req, res) => res.json(await InnerBanner.findByIdAndUpdate(req.params.id, innerBannerSchema.partial().parse(req.body), { new: true }));
export const createFaq = async (req, res) => res.status(201).json(await Faq.create(faqSchema.parse(req.body)));
export const updateFaq = async (req, res) => res.json(await Faq.findByIdAndUpdate(req.params.id, faqSchema.partial().parse(req.body), { new: true }));
export const createBlog = async (req, res) => res.status(201).json(await BlogPost.create(blogSchema.parse(req.body)));
export const updateBlog = async (req, res) => res.json(await BlogPost.findByIdAndUpdate(req.params.id, blogSchema.partial().parse(req.body), { new: true }));
export const updateSupportTicket = async (req, res) => res.json(await SupportTicket.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true }).populate("user"));
export const deleteInnerBanner = async (req, res) => {
  const item = await InnerBanner.findByIdAndDelete(req.params.id);
  if (!item) return res.status(404).json({ message: "Inner banner not found" });
  res.json({ success: true });
};
export const deleteFaq = async (req, res) => {
  const item = await Faq.findByIdAndDelete(req.params.id);
  if (!item) return res.status(404).json({ message: "FAQ not found" });
  res.json({ success: true });
};
export const deleteBlog = async (req, res) => {
  const item = await BlogPost.findByIdAndDelete(req.params.id);
  if (!item) return res.status(404).json({ message: "Blog not found" });
  res.json({ success: true });
};

export const uploadMedia = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "File is required" });
  res.json({ fileName: req.file.filename, url: `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}` });
};

export const changeAdminPassword = async (req, res) => {
  const payload = passwordSchema.parse(req.body);
  if (payload.newPassword !== payload.confirmPassword) return res.status(400).json({ message: "New password and confirm password must match" });
  const admin = await AdminUser.findById(req.auth.sub);
  if (!admin) return res.status(404).json({ message: "Admin not found" });
  const matches = await bcrypt.compare(payload.oldPassword, admin.passwordHash);
  if (!matches) return res.status(400).json({ message: "Old password is incorrect" });
  admin.passwordHash = await bcrypt.hash(payload.newPassword, 12);
  await admin.save();
  res.json({ success: true });
};

export const getPublicSite = async (_req, res) => {
  const [homepageContent, banners, settings, faqs, innerBanners, blogs] = await Promise.all([
    HomepageContent.findOne().sort({ updatedAt: -1 }).lean(),
    Banner.find({ active: true }).sort({ createdAt: -1 }).lean(),
    getSettingsAsMap(),
    Faq.find({ active: true }).sort({ order: 1, createdAt: -1 }).lean(),
    InnerBanner.find({ active: true }).sort({ createdAt: -1 }).lean(),
    BlogPost.find({ published: true }).sort({ createdAt: -1 }).limit(6).lean()
  ]);
  res.json({ homepageContent: homepageContent || {}, banners, branding: settings.branding || {}, configuration: settings.configuration || {}, maintenance: settings.maintenance || {}, email: settings.email || {}, notifications: settings.notifications || {}, faqs, innerBanners, blogs });
};

export const getPublicFaqs = async (_req, res) => {
  res.json(await Faq.find({ active: true }).sort({ order: 1, createdAt: -1 }).lean());
};

export const getPublicBlogs = async (_req, res) => {
  res.json(await BlogPost.find({ published: true }).sort({ createdAt: -1 }).lean());
};

export const getPublicBlog = async (req, res) => {
  const blog = await BlogPost.findOne({ slug: req.params.slug, published: true }).lean();
  if (!blog) return res.status(404).json({ message: "Blog not found" });
  res.json(blog);
};
