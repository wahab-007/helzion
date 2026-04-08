import { Router } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { createEmergencyContactLocationRequest, createWhatsAppLocationRequestWebhook } from "../controllers/realtime.controller.js";
import { getHomepageContent, getPublicBlog, getPublicBlogs, getPublicFaqs, getPublicSite, listBanners } from "../controllers/admin.controller.js";

export const publicRouter = Router();
publicRouter.get("/homepage", asyncHandler(getHomepageContent));
publicRouter.get("/banners", asyncHandler(listBanners));
publicRouter.get("/site", asyncHandler(getPublicSite));
publicRouter.get("/faqs", asyncHandler(getPublicFaqs));
publicRouter.get("/blogs", asyncHandler(getPublicBlogs));
publicRouter.get("/blogs/:slug", asyncHandler(getPublicBlog));
publicRouter.post("/location-requests/contact", asyncHandler(createEmergencyContactLocationRequest));
publicRouter.post("/webhooks/twilio/whatsapp/location-request", asyncHandler(createWhatsAppLocationRequestWebhook));
