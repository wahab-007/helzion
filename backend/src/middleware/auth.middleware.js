import jwt from "jsonwebtoken";

const accessSecret = process.env.JWT_ACCESS_SECRET || "change_me";

export const requireAuth = (roles = []) => (req, res, next) => {
  const token = req.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({ message: "Missing token" });
  }

  try {
    const payload = jwt.verify(token, accessSecret);
    if (roles.length && !roles.some((role) => payload.roles?.includes(role))) {
      return res.status(403).json({ message: "Forbidden" });
    }
    req.auth = payload;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
};
