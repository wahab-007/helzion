import { Router } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { requireDeviceToken } from "../middleware/device.middleware.js";
import { cancelAccident, getDeviceSettings, loginDevice, pushStatus, sendAccident } from "../controllers/device.controller.js";

export const deviceRouter = Router();
deviceRouter.post("/login", asyncHandler(loginDevice));
deviceRouter.get("/settings", requireDeviceToken, asyncHandler(getDeviceSettings));
deviceRouter.post("/status", requireDeviceToken, asyncHandler(pushStatus));
deviceRouter.post("/accidents", requireDeviceToken, asyncHandler(sendAccident));
deviceRouter.post("/accidents/:id/cancel", requireDeviceToken, asyncHandler(cancelAccident));
