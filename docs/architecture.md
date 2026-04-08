# Architecture

## Services

1. ESP32 firmware authenticates with `espId` and `secretKey`.
2. Backend validates device registration and returns device settings snapshot.
3. Firmware uses server-managed settings for timers, thresholds, and messaging behavior.
4. Backend stores alerts, helmet status, and notification delivery records.
5. Web admin manages content, devices, settings, and support.
6. Mobile app provides user monitoring, onboarding, map tracking, and account management.

## Security

- JWT access and refresh tokens for users and admins
- bcrypt password hashing
- device credentials with server-issued session token
- rate limiting
- role-based access control
- helmet blacklist and disable flow
- audit logging

## Config Strategy

Static secrets stay in server environment variables.

Runtime operational values are stored in the `settings` collection and editable from admin UI:

- `accident.countdownSeconds`
- `sos.holdSeconds`
- `notifications.twilio.accountSid`
- `notifications.twilio.authToken`
- `notifications.twilio.smsFrom`
- `notifications.twilio.whatsappFrom`
- `maps.googleApiKey`
- `firmware.otaUrl`
- `firmware.thresholds.*`
- `features.*`
