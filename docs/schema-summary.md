# Data Model Summary

Collections defined in backend models:
- users
- helmets
- emergencycontacts
- accidentlogs
- notifications
- adminusers
- homepagecontents
- banners
- firmwareupdates
- supporttickets
- helmetstatuslogs
- loginactivities
- devicesessions
- settings
- contactusmessages

Every collection uses timestamps.

## Important runtime-managed settings
- accident.countdownSeconds
- sos.holdSeconds
- notifications.twilio.accountSid
- notifications.twilio.authToken
- notifications.twilio.smsFrom
- notifications.twilio.whatsappFrom
- maps.googleApiKey
- firmware.otaUrl
- firmware.thresholds.impactDebounceMs
- firmware.thresholds.helmetWearThreshold
- features.bluetoothCallSupport
- features.offlineSync
