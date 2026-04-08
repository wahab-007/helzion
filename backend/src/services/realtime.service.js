import crypto from "crypto";
import http from "http";
import jwt from "jsonwebtoken";
import { WebSocketServer } from "ws";
import { EmergencyContact, Helmet, LocationRequest, User } from "../models/index.js";
import { sendSms, sendWhatsApp } from "./notification.service.js";

const accessSecret = process.env.JWT_ACCESS_SECRET || "change_me";
const authTimeoutMs = Number(process.env.WS_AUTH_TIMEOUT_MS || 10000);
const requestTtlMs = Number(process.env.LOCATION_REQUEST_TTL_MS || 60000);

const state = {
  wss: null,
  helmets: new Map(),
  users: new Map(),
  admins: new Set()
};

const socketState = new WeakMap();

const toSet = (map, key) => {
  if (!map.has(key)) map.set(key, new Set());
  return map.get(key);
};

const removeSocket = (socket) => {
  const auth = socketState.get(socket);
  if (!auth) return;
  if (auth.kind === "helmet") {
    const set = state.helmets.get(auth.helmetId);
    if (set) {
      set.delete(socket);
      if (!set.size) state.helmets.delete(auth.helmetId);
    }
  }
  if (auth.kind === "user") {
    const set = state.users.get(auth.userId);
    if (set) {
      set.delete(socket);
      if (!set.size) state.users.delete(auth.userId);
    }
  }
  if (auth.kind === "admin") {
    state.admins.delete(socket);
  }
  socketState.delete(socket);
};

const sendJson = (socket, payload) => {
  if (socket.readyState === 1) {
    socket.send(JSON.stringify(payload));
  }
};

const broadcast = (sockets, payload) => {
  (sockets || []).forEach((socket) => sendJson(socket, payload));
};

const normalizePhone = (value = "") => String(value).replace(/[^\d+]/g, "").replace(/^00/, "+");
const getId = (value) => String(value?._id || value || "");

const buildHelmetRoomPayload = (helmet, userId) => ({
  type: "socket:authenticated",
  role: "helmet",
  helmet: {
    id: String(helmet._id),
    helmetId: helmet.espId,
    espId: helmet.espId,
    userId: userId ? String(userId) : null
  }
});

const buildActorPayload = (payload, role) => ({
  type: "socket:authenticated",
  role,
  actor: {
    id: String(payload.sub),
    roles: payload.roles || []
  }
});

const buildLocationPrompt = (request) => ({
  type: "location_request:deliver",
  request: {
    id: String(request._id),
    token: request.requestToken,
    reason: request.reason,
    message: request.message,
    sourceChannel: request.sourceChannel,
    requestedByType: request.requestedByType,
    expiresAt: request.expiresAt
  }
});

const notifyRequestWatchers = (request, type, extra = {}) => {
  const payload = {
    type,
    request: {
      id: String(request._id),
      helmetId: getId(request.helmet),
      userId: getId(request.user),
      status: request.status,
      sourceChannel: request.sourceChannel,
      requestedByType: request.requestedByType,
      reason: request.reason,
      message: request.message,
      expiresAt: request.expiresAt,
      respondedAt: request.respondedAt,
      deliveredAt: request.deliveredAt,
      lastKnownLocation: request.lastKnownLocation || null,
      ...extra
    }
  };

  broadcast(state.users.get(getId(request.user)), payload);
  broadcast(state.admins, payload);
};

const deliverRequestToHelmet = async (request) => {
  const sockets = state.helmets.get(getId(request.helmet));
  if (!sockets?.size) {
    return { delivered: false };
  }

  request.status = "delivered";
  request.deliveredAt = new Date();
  await request.save();
  broadcast(sockets, buildLocationPrompt(request));
  notifyRequestWatchers(request, "location_request:queued", { online: true });
  return { delivered: true };
};

const findEligibleHelmetForUser = async (userId, helmetId) => {
  const query = { user: userId, isAssigned: true, isActive: true, isBlacklisted: false };
  if (helmetId) query._id = helmetId;
  return Helmet.findOne(query).sort({ updatedAt: -1 });
};

const createLocationRequestRecord = async ({ helmetId, userId, requestedByType, requestedByUserId, contactId, sourceChannel, reason, message }) => {
  const request = await LocationRequest.create({
    helmet: helmetId,
    user: userId,
    requestedByType,
    requestedByUser: requestedByUserId || undefined,
    contact: contactId || undefined,
    sourceChannel: sourceChannel || "web",
    reason: reason || "location_requested",
    message: message || "Share current helmet location",
    requestToken: crypto.randomBytes(16).toString("hex"),
    expiresAt: new Date(Date.now() + requestTtlMs)
  });

  const populated = await LocationRequest.findById(request._id).populate("contact user helmet requestedByUser");
  await deliverRequestToHelmet(populated);
  return populated;
};

const notifyContactWithResolvedLocation = async (request) => {
  if (!request.contact || !request.lastKnownLocation) return;
  const mapsUrl = request.lastKnownLocation.mapUrl || `https://maps.google.com/?q=${request.lastKnownLocation.lat},${request.lastKnownLocation.lng}`;
  const message = `SmartHelmet location update: ${request.user.fullName} current location is ${mapsUrl}`;
  const whatsappNumber = normalizePhone(request.contact.whatsappNumber);
  const phoneNumber = normalizePhone(request.contact.phoneNumber);

  if (whatsappNumber) {
    await sendWhatsApp({ recipient: whatsappNumber, message, user: request.user._id, helmet: request.helmet._id });
    return;
  }
  if (phoneNumber) {
    await sendSms({ recipient: phoneNumber, message, user: request.user._id, helmet: request.helmet._id });
  }
};

export const createLocationRequestForUser = async ({ userId, helmetId, sourceChannel = "web", reason, message }) => {
  const helmet = await findEligibleHelmetForUser(userId, helmetId);
  if (!helmet) {
    throw new Error("Active helmet not found for location request");
  }
  return createLocationRequestRecord({
    helmetId: helmet._id,
    userId,
    requestedByType: "user",
    requestedByUserId: userId,
    sourceChannel,
    reason,
    message
  });
};

export const createLocationRequestForAdmin = async ({ adminId, helmetId, reason, message }) => {
  const helmet = await Helmet.findOne({ _id: helmetId, isAssigned: true, isActive: true, isBlacklisted: false });
  if (!helmet?.user) {
    throw new Error("Helmet not found or not assigned");
  }
  return createLocationRequestRecord({
    helmetId: helmet._id,
    userId: helmet.user,
    requestedByType: "admin",
    requestedByUserId: adminId,
    sourceChannel: "admin",
    reason,
    message
  });
};

export const createLocationRequestForEmergencyContact = async ({ phoneNumber, helmetId, espId, reason, message }) => {
  const normalized = normalizePhone(phoneNumber);
  const contact = await EmergencyContact.findOne({
    $or: [
      { phoneNumber: normalized },
      { whatsappNumber: normalized },
      { phoneNumber },
      { whatsappNumber: phoneNumber }
    ]
  });

  if (!contact) {
    throw new Error("Emergency contact not found");
  }

  const helmetQuery = { user: contact.user, isAssigned: true, isActive: true, isBlacklisted: false };
  if (helmetId || espId) helmetQuery.espId = helmetId || espId;
  const helmet = await Helmet.findOne(helmetQuery).sort({ updatedAt: -1 });
  if (!helmet) {
    throw new Error("No active helmet available for this emergency contact");
  }

  return createLocationRequestRecord({
    helmetId: helmet._id,
    userId: contact.user,
    requestedByType: "contact",
    contactId: contact._id,
    sourceChannel: "whatsapp",
    reason,
    message
  });
};

export const resolveLocationRequest = async ({ requestId, helmetId, location, metadata }) => {
  const request = await LocationRequest.findOne({
    _id: requestId,
    helmet: helmetId,
    status: { $in: ["pending", "delivered", "acknowledged"] },
    expiresAt: { $gt: new Date() }
  }).populate("contact user helmet requestedByUser");

  if (!request) {
    throw new Error("Location request not found or expired");
  }

  request.status = "responded";
  request.respondedAt = new Date();
  request.lastKnownLocation = {
    ...location,
    mapUrl: location?.mapUrl || `https://maps.google.com/?q=${location?.lat},${location?.lng}`
  };
  request.responseMetadata = metadata || {};
  await request.save();
  await notifyContactWithResolvedLocation(request);
  notifyRequestWatchers(request, "location_request:resolved");
  return request;
};

export const acknowledgeLocationRequest = async ({ requestId, helmetId }) => {
  const request = await LocationRequest.findOne({
    _id: requestId,
    helmet: helmetId,
    status: { $in: ["pending", "delivered"] },
    expiresAt: { $gt: new Date() }
  });

  if (!request) {
    throw new Error("Location request not found or expired");
  }

  request.status = "acknowledged";
  await request.save();
  notifyRequestWatchers(request, "location_request:acknowledged");
  return request;
};

export const publishHelmetStatusUpdate = ({ helmet, status }) => {
  if (!helmet?._id || !status) return;
  const payload = {
    type: "helmet:status",
    helmet: {
      id: String(helmet._id),
      helmetId: helmet.espId,
      espId: helmet.espId,
      ridingModeActive: helmet.ridingModeActive,
      isActive: helmet.isActive
    },
    status
  };
  if (helmet.user) {
    broadcast(state.users.get(String(helmet.user)), payload);
  }
  broadcast(state.admins, payload);
};

const authenticateHelmetSocket = async (socket, payload) => {
  const helmet = await Helmet.findOne({
    espId: payload.helmetId || payload.espId,
    secretKey: payload.secretKey,
    isActive: true,
    isBlacklisted: false
  });

  if (!helmet) {
    sendJson(socket, { type: "socket:error", message: "Helmet websocket authentication failed" });
    socket.close(4001, "auth_failed");
    return;
  }

  const auth = { kind: "helmet", helmetId: String(helmet._id), userId: helmet.user ? String(helmet.user) : null };
  socketState.set(socket, auth);
  toSet(state.helmets, auth.helmetId).add(socket);
  clearTimeout(socket.authTimer);
  sendJson(socket, buildHelmetRoomPayload(helmet, helmet.user));

  const pendingRequests = await LocationRequest.find({
    helmet: helmet._id,
    status: { $in: ["pending", "delivered", "acknowledged"] },
    expiresAt: { $gt: new Date() }
  }).sort({ createdAt: 1 }).limit(20);
  pendingRequests.forEach((request) => sendJson(socket, buildLocationPrompt(request)));
};

const authenticateActorSocket = async (socket, payload) => {
  const token = payload.token || payload.accessToken;
  if (!token) {
    sendJson(socket, { type: "socket:error", message: "Missing access token" });
    socket.close(4001, "auth_failed");
    return;
  }

  const decoded = jwt.verify(token, accessSecret);
  const isAdmin = (decoded.roles || []).includes("admin");
  const auth = { kind: isAdmin ? "admin" : "user", userId: String(decoded.sub), roles: decoded.roles || [] };
  socketState.set(socket, auth);
  clearTimeout(socket.authTimer);

  if (isAdmin) {
    state.admins.add(socket);
    sendJson(socket, buildActorPayload(decoded, "admin"));
    return;
  }

  const user = await User.findById(decoded.sub).select("_id fullName");
  toSet(state.users, String(decoded.sub)).add(socket);
  sendJson(socket, { ...buildActorPayload(decoded, "user"), actor: { id: String(decoded.sub), fullName: user?.fullName || "User" } });
};

const handleAuthedMessage = async (socket, payload) => {
  const auth = socketState.get(socket);
  if (!auth) return;

  if (auth.kind === "helmet") {
    if (payload.type === "location_request:ack") {
      await acknowledgeLocationRequest({ requestId: payload.requestId, helmetId: auth.helmetId });
      return;
    }
    if (payload.type === "location_request:response") {
      await resolveLocationRequest({
        requestId: payload.requestId,
        helmetId: auth.helmetId,
        location: payload.location,
        metadata: payload.metadata
      });
      return;
    }
    return;
  }

  if (payload.type === "location_request:create" && auth.kind === "user") {
    const request = await createLocationRequestForUser({
      userId: auth.userId,
      helmetId: payload.helmetId,
      sourceChannel: payload.sourceChannel || "web",
      reason: payload.reason,
      message: payload.message
    });
    sendJson(socket, { type: "location_request:created", request });
    return;
  }

  if (payload.type === "location_request:create" && auth.kind === "admin") {
    const request = await createLocationRequestForAdmin({
      adminId: auth.userId,
      helmetId: payload.helmetId,
      reason: payload.reason,
      message: payload.message
    });
    sendJson(socket, { type: "location_request:created", request });
  }
};

const handleSocketMessage = async (socket, raw) => {
  let payload;
  try {
    payload = JSON.parse(String(raw));
  } catch {
    sendJson(socket, { type: "socket:error", message: "Invalid JSON payload" });
    return;
  }

  const auth = socketState.get(socket);
  if (!auth) {
    if (payload.type === "auth:helmet") {
      await authenticateHelmetSocket(socket, payload);
      return;
    }
    if (payload.type === "auth:user" || payload.type === "auth:admin" || payload.type === "auth:app") {
      await authenticateActorSocket(socket, payload);
      return;
    }
    sendJson(socket, { type: "socket:error", message: "Authenticate first" });
    return;
  }

  await handleAuthedMessage(socket, payload);
};

export const createRealtimeServer = (app) => {
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: "/ws" });
  state.wss = wss;

  wss.on("connection", (socket) => {
    socket.authTimer = setTimeout(() => {
      sendJson(socket, { type: "socket:error", message: "Authentication timeout" });
      socket.close(4001, "auth_timeout");
    }, authTimeoutMs);

    socket.on("message", async (raw) => {
      try {
        await handleSocketMessage(socket, raw);
      } catch (error) {
        sendJson(socket, { type: "socket:error", message: error.message || "Realtime request failed" });
      }
    });

    socket.on("close", () => {
      clearTimeout(socket.authTimer);
      removeSocket(socket);
    });

    socket.on("error", () => {
      clearTimeout(socket.authTimer);
      removeSocket(socket);
    });

    sendJson(socket, { type: "socket:ready", message: "Authenticate to start realtime communication" });
  });

  return server;
};




