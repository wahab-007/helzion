import bcrypt from "bcryptjs";
import { AdminUser } from "../models/index.js";

const defaultAdminEmail = (process.env.DEFAULT_ADMIN_EMAIL || "admin@helzion.com").toLowerCase();
const defaultAdminPassword = process.env.DEFAULT_ADMIN_PASSWORD || "78678600";
const defaultAdminName = process.env.DEFAULT_ADMIN_NAME || "System Admin";

export const bootstrapDefaultAdmin = async () => {
  const existingAdmin = await AdminUser.findOne({ email: defaultAdminEmail });
  if (existingAdmin) return existingAdmin;

  const passwordHash = await bcrypt.hash(defaultAdminPassword, 12);
  return AdminUser.create({
    name: defaultAdminName,
    email: defaultAdminEmail,
    passwordHash,
    permissions: ["*"],
    isActive: true
  });
};
