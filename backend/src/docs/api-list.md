# API List

## Auth
- POST /api/auth/register
- POST /api/auth/login

## User
- GET /api/user/me
- GET /api/user/helmets
- GET /api/user/contacts
- POST /api/user/contacts
- GET /api/user/accidents
- GET /api/user/status

## Device
- POST /api/device/login
- GET /api/device/settings
- POST /api/device/status
- POST /api/device/accidents
- POST /api/device/accidents/:id/cancel

## Admin
- GET /api/admin/dashboard
- GET /api/admin/users
- GET /api/admin/helmets
- POST /api/admin/helmets
- PUT /api/admin/settings/:key
- PUT /api/admin/cms/homepage
- POST /api/admin/banners
