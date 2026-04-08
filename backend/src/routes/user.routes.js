import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";
import { createUserLocationRequest } from "../controllers/realtime.controller.js";
import { accidentHistory, deleteEmergencyContact, emergencyContacts, helmetOverview, liveStatus, me, notifications, updateEmergencyContact, updateMe } from "../controllers/user.controller.js";

export const userRouter = Router();
userRouter.use(requireAuth(["user", "admin"]));
userRouter.get("/me", asyncHandler(me));
userRouter.put("/me", asyncHandler(updateMe));
userRouter.get("/helmets", asyncHandler(helmetOverview));
userRouter.get("/contacts", asyncHandler(emergencyContacts));
userRouter.post("/contacts", asyncHandler(emergencyContacts));
userRouter.put("/contacts/:contactId", asyncHandler(updateEmergencyContact));
userRouter.delete("/contacts/:contactId", asyncHandler(deleteEmergencyContact));
userRouter.get("/accidents", asyncHandler(accidentHistory));
userRouter.get("/notifications", asyncHandler(notifications));
userRouter.get("/status", asyncHandler(liveStatus));
userRouter.post("/location-requests", asyncHandler(createUserLocationRequest));
