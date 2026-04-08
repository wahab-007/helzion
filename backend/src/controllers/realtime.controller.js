import { z } from "zod";
import { createLocationRequestForAdmin, createLocationRequestForEmergencyContact, createLocationRequestForUser } from "../services/realtime.service.js";

const userLocationRequestSchema = z.object({
  helmetId: z.string().optional(),
  reason: z.string().optional(),
  message: z.string().optional(),
  sourceChannel: z.enum(["web", "mobile", "admin", "whatsapp", "sms", "system"]).optional()
});

const adminLocationRequestSchema = z.object({
  helmetId: z.string().min(1),
  reason: z.string().optional(),
  message: z.string().optional()
});

const contactLocationRequestSchema = z.object({
  phoneNumber: z.string().min(5),
  helmetId: z.string().optional(),
  espId: z.string().optional(),
  reason: z.string().optional(),
  message: z.string().optional()
});

export const createUserLocationRequest = async (req, res) => {
  const payload = userLocationRequestSchema.parse(req.body || {});
  const request = await createLocationRequestForUser({
    userId: req.auth.sub,
    helmetId: payload.helmetId,
    sourceChannel: payload.sourceChannel || "web",
    reason: payload.reason,
    message: payload.message
  });
  res.status(201).json(request);
};

export const createAdminLocationRequest = async (req, res) => {
  const payload = adminLocationRequestSchema.parse(req.body || {});
  const request = await createLocationRequestForAdmin({
    adminId: req.auth.sub,
    helmetId: payload.helmetId,
    reason: payload.reason,
    message: payload.message
  });
  res.status(201).json(request);
};

export const createEmergencyContactLocationRequest = async (req, res) => {
  const payload = contactLocationRequestSchema.parse(req.body || {});
  const request = await createLocationRequestForEmergencyContact(payload);
  res.status(201).json({
    message: "Location request accepted",
    requestId: request._id,
    status: request.status
  });
};

export const createWhatsAppLocationRequestWebhook = async (req, res) => {
  const from = String(req.body?.From || "").replace(/^whatsapp:/, "");
  const helmetId = String(req.body?.Body || "").match(/helmet[:\s-]*([A-Za-z0-9-]+)/i)?.[1];
  const request = await createLocationRequestForEmergencyContact({
    phoneNumber: from,
    helmetId,
    reason: "whatsapp_location_request",
    message: "Emergency contact requested live location over WhatsApp"
  });

  res.status(201).json({
    message: "Helmet location request queued",
    requestId: request._id,
    status: request.status
  });
};
