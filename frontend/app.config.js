const { expo } = require("./app.json");

module.exports = {
  ...expo,

  runtimeVersion: {
    policy: "appVersion",
  },

  updates: {
    url: "https://u.expo.dev/359ebdde-df2e-4c0f-87aa-29dc8a76d049",
  },

  android: {
    ...expo.android,
    googleServicesFile:
      process.env.GOOGLE_SERVICES_JSON || "./google-services.json",
  },
};