# Deployment Guide

## Backend

1. Provision MongoDB Atlas or self-hosted MongoDB.
2. Set environment variables from `.env.example`.
3. Build and run the Node API behind HTTPS.
4. Configure a reverse proxy and enable CORS only for trusted origins.

## Web

1. Build the React app.
2. Serve static assets via CDN or reverse proxy.
3. Point the app to the backend API base URL.

## Mobile

1. Configure Firebase for push notifications.
2. Add Android and iOS map keys.
3. Build with release signing.

## Firmware

1. Flash ESP32 with the firmware.
2. Provision `espId` and `secretKey`.
3. Register the helmet in admin portal.
4. Use captive portal to join WiFi.

## Production Checklist

- enable TLS everywhere
- rotate server secrets
- enforce backup policy
- configure Twilio senders
- configure email service
- test OTA rollback path
- validate GPS fallback behavior
