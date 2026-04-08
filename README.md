# Smart Helmet Monorepo

Production-oriented starter for an IoT-based smart helmet platform with:

- `backend`: Node.js, Express, MongoDB API
- `web`: React + Tailwind dashboard/public site scaffold
- `mobile`: Flutter app scaffold
- `firmware`: ESP32 firmware scaffold
- `docs`: architecture and deployment docs

## Core Design Rule

Operational values are not hardcoded. The admin portal controls:

- accident countdown duration
- SOS hold duration
- Twilio credentials
- Google API credentials
- alert templates
- feature flags
- OTA rollout settings
- threshold values for firmware behavior

## Workspaces

- backend
- web
- mobile
- firmware
- docs

## Status

This repository contains a strong production-ready foundation and reference implementation structure. Before deployment, install dependencies, set environment variables, wire secrets, and complete hardware-specific validation.