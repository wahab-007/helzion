import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { upload } from "../middleware/upload.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";
import { createAdminLocationRequest } from "../controllers/realtime.controller.js";
import {
  changeAdminPassword,
  createBanner,
  createBlog,
  createFaq,
  createHelmet,
  createInnerBanner,
  createUser,
  dashboard,
  deleteBlog,
  deleteFaq,
  deleteInnerBanner,
  getCmsBundle,
  getHomepageContent,
  getIncidentDetails,
  listBanners,
  listBlogs,
  listContactMessages,
  listFaqs,
  listHelmets,
  listIncidents,
  listInnerBanners,
  listSettings,
  listSupportTickets,
  listUsers,
  saveHomepageContent,
  updateBanner,
  updateBlog,
  updateFaq,
  updateHelmet,
  updateIncident,
  updateInnerBanner,
  updateSetting,
  updateSupportTicket,
  updateUser,
  uploadMedia
} from "../controllers/admin.controller.js";

export const adminRouter = Router();
adminRouter.use(requireAuth(["admin"]));
adminRouter.get("/dashboard", asyncHandler(dashboard));
adminRouter.get("/users", asyncHandler(listUsers));
adminRouter.get("/helmets", asyncHandler(listHelmets));
adminRouter.get("/incidents", asyncHandler(listIncidents));
adminRouter.get("/incidents/:id", asyncHandler(getIncidentDetails));
adminRouter.get("/settings", asyncHandler(listSettings));
adminRouter.get("/cms", asyncHandler(getCmsBundle));
adminRouter.get("/cms/homepage", asyncHandler(getHomepageContent));
adminRouter.get("/banners", asyncHandler(listBanners));
adminRouter.get("/inner-banners", asyncHandler(listInnerBanners));
adminRouter.get("/faqs", asyncHandler(listFaqs));
adminRouter.get("/blogs", asyncHandler(listBlogs));
adminRouter.get("/support-tickets", asyncHandler(listSupportTickets));
adminRouter.get("/contact-messages", asyncHandler(listContactMessages));
adminRouter.post("/users", asyncHandler(createUser));
adminRouter.post("/helmets", asyncHandler(createHelmet));
adminRouter.post("/location-requests", asyncHandler(createAdminLocationRequest));
adminRouter.post("/banners", asyncHandler(createBanner));
adminRouter.post("/inner-banners", asyncHandler(createInnerBanner));
adminRouter.post("/faqs", asyncHandler(createFaq));
adminRouter.post("/blogs", asyncHandler(createBlog));
adminRouter.post("/uploads", upload.single("file"), asyncHandler(uploadMedia));
adminRouter.put("/users/:id", asyncHandler(updateUser));
adminRouter.put("/helmets/:id", asyncHandler(updateHelmet));
adminRouter.put("/incidents/:id", asyncHandler(updateIncident));
adminRouter.put("/settings/:key", asyncHandler(updateSetting));
adminRouter.put("/cms/homepage", asyncHandler(saveHomepageContent));
adminRouter.put("/banners/:id", asyncHandler(updateBanner));
adminRouter.put("/inner-banners/:id", asyncHandler(updateInnerBanner));
adminRouter.put("/faqs/:id", asyncHandler(updateFaq));
adminRouter.put("/blogs/:id", asyncHandler(updateBlog));
adminRouter.put("/support-tickets/:id", asyncHandler(updateSupportTicket));
adminRouter.delete("/inner-banners/:id", asyncHandler(deleteInnerBanner));
adminRouter.delete("/faqs/:id", asyncHandler(deleteFaq));
adminRouter.delete("/blogs/:id", asyncHandler(deleteBlog));
adminRouter.put("/account/password", asyncHandler(changeAdminPassword));
