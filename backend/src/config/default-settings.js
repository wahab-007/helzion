export const defaultSettings = [
  {
    key: "accident",
    value: {
      countdownSeconds: 15,
      falseAlarmCooldownSeconds: 30,
      severityThresholds: {
        low: 1,
        medium: 2,
        severe: 3
      }
    }
  },
  {
    key: "sos",
    value: {
      holdSeconds: 5,
      enabled: true
    }
  },
  {
    key: "notifications",
    value: {
      smsEnabled: true,
      whatsappEnabled: true,
      emailEnabled: true,
      pushEnabled: true,
      twilio: {
        accountSid: "",
        authToken: "",
        smsFrom: "",
        whatsappFrom: ""
      }
    }
  },
  {
    key: "maps",
    value: {
      googleApiKey: "",
      geolocationEnabled: true
    }
  },
  {
    key: "firmware",
    value: {
      minFirmwareVersion: "1.0.0",
      otaUrl: "",
      thresholds: {
        impactDebounceMs: 500,
        helmetWearThreshold: 500
      },
      deepSleepEnabled: true
    }
  },
  {
    key: "features",
    value: {
      bluetoothCallSupport: true,
      offlineSync: true,
      gpsTracking: true,
      familyDashboard: true,
      geofencing: false
    }
  },
  {
    key: "branding",
    value: {
      siteName: "SmartHelmet",
      headerLogoText: "SmartHelmet",
      footerLogoText: "SmartHelmet",
      faviconUrl: ""
    }
  },
  {
    key: "configuration",
    value: {
      companyName: "SmartHelmet",
      email1: "support@smarthelmet.com",
      email2: "sales@smarthelmet.com",
      phone1: "+92 300 1234567",
      phone2: "+92 321 7654321",
      whatsapp: "+92 300 1234567",
      address: "123 Tech Plaza, Block 7, Karachi, Pakistan",
      copyrights: "Copyright 2026 SmartHelmet. All rights reserved.",
      facebook: "",
      twitter: "",
      instagram: "",
      linkedin: ""
    }
  },
  {
    key: "email",
    value: {
      fromName: "SmartHelmet",
      fromEmail: "support@smarthelmet.com",
      host: "",
      port: 587,
      encryption: "TLS",
      username: "",
      password: "",
      isDefault: true,
      status: "inactive"
    }
  },
  {
    key: "maintenance",
    value: {
      enabled: false,
      endsAt: "",
      visitorMessage: "Website under maintenance"
    }
  }
];
