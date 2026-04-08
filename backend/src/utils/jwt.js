import jwt from "jsonwebtoken";

const accessSecret = process.env.JWT_ACCESS_SECRET || "change_me";
const refreshSecret = process.env.JWT_REFRESH_SECRET || "change_me";

export const signAccessToken = (payload) =>
  jwt.sign(payload, accessSecret, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m"
  });

export const signRefreshToken = (payload) =>
  jwt.sign(payload, refreshSecret, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "30d"
  });
