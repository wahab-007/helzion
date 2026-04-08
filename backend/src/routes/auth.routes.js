import { Router } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { adminLogin, login, register, submitContactMessage } from "../controllers/auth.controller.js";

export const authRouter = Router();

authRouter.post("/register", asyncHandler(register));
authRouter.post("/login", asyncHandler(login));
authRouter.post("/admin/login", asyncHandler(adminLogin));
authRouter.post("/contact", asyncHandler(submitContactMessage));
