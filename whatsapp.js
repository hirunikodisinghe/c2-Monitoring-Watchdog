"use strict";

require("dotenv").config();

const path =
  require("path");

const qrcode =
  require("qrcode-terminal");

const {
  Client,
  LocalAuth
} = require("whatsapp-web.js");


let client =
  null;

let ready =
  false;

let starting =
  false;

let lastStatus =
  "Not started";


function booleanEnv(
  name,
  fallback
) {

  const value =
    process.env[name];

  if (
    value === undefined ||
    value === ""
  ) {

    return fallback;
  }

  return (
    String(value)
      .toLowerCase()
    === "true"
  );
}


// ============================================================
// START WHATSAPP
// ============================================================

async function startWhatsApp() {

  if (
    ready ||
    starting
  ) {

    return;
  }


  starting =
    true;


  const clientId =

    process.env
      .WHATSAPP_CLIENT_ID

    ||

    "c2-monitor-alerts";


  client =
    new Client({

      authStrategy:
        new LocalAuth({

          clientId,

          dataPath:
            path.join(
              __dirname,
              ".wwebjs_alert_auth"
            )
        }),


      puppeteer: {

        headless:
          booleanEnv(
            "WHATSAPP_HEADLESS",
            false
          ),

        executablePath:

          process.env
            .CHROME_PATH

          ||

          undefined,


        args: [

          "--no-sandbox",

          "--disable-setuid-sandbox",

          "--disable-dev-shm-usage",

          "--disable-background-timer-throttling",

          "--disable-renderer-backgrounding",

          "--disable-backgrounding-occluded-windows"
        ]
      }
    });


  client.on(
    "qr",
    value => {

      lastStatus =
        "QR required";

      console.log(
        "\nScan this QR code using WhatsApp -> Linked Devices:\n"
      );


      qrcode.generate(
        value,
        {
          small:
            true
        }
      );
    }
  );


  client.on(
    "authenticated",
    () => {

      lastStatus =
        "Authenticated";

      console.log(
        "WhatsApp alert sender authenticated."
      );
    }
  );


  client.on(
    "ready",
    () => {

      ready =
        true;

      starting =
        false;

      lastStatus =
        "Connected";

      console.log(
        "WhatsApp alert sender connected."
      );
    }
  );


  client.on(
    "auth_failure",
    message => {

      ready =
        false;

      starting =
        false;

      lastStatus =
        `Authentication failed: ${message}`;

      console.error(
        lastStatus
      );
    }
  );


  client.on(
    "disconnected",
    reason => {

      ready =
        false;

      starting =
        false;

      lastStatus =
        `Disconnected: ${reason}`;

      console.error(
        lastStatus
      );
    }
  );


  try {

    lastStatus =
      "Connecting";

    await client.initialize();

  } catch (error) {

    ready =
      false;

    starting =
      false;

    lastStatus =
      error.message;

    throw error;
  }
}


// ============================================================
// SEND MESSAGE
// ============================================================

async function sendWhatsApp(
  message
) {

  const groupId =

    String(
      process.env
        .WHATSAPP_GROUP_ID ||
      ""
    ).trim();


  if (!groupId) {

    throw new Error(
      "WHATSAPP_GROUP_ID is empty in .env"
    );
  }


  if (
    !groupId.endsWith(
      "@g.us"
    )
  ) {

    throw new Error(
      "Invalid WHATSAPP_GROUP_ID"
    );
  }


  if (
    !ready ||
    !client
  ) {

    throw new Error(
      `WhatsApp alert sender is not ready: ${lastStatus}`
    );
  }


  await client.sendMessage(

    groupId,

    message,

    {
      sendSeen:
        false
    }
  );
}


// ============================================================
// STATUS
// ============================================================

function getWhatsAppAlertStatus() {

  return {

    ready,

    status:
      lastStatus
  };
}


// ============================================================
// STOP
// ============================================================

async function stopWhatsApp() {

  ready =
    false;


  if (client) {

    await client
      .destroy()
      .catch(
        () => {}
      );
  }
}


// ============================================================
// MANUAL TEST
// ============================================================

async function testWhatsApp() {

  try {

    await startWhatsApp();


    for (
      let i = 0;
      i < 60 && !ready;
      i++
    ) {

      await new Promise(
        resolve =>
          setTimeout(
            resolve,
            1000
          )
      );
    }


    if (!ready) {

      throw new Error(
        `WhatsApp not ready: ${lastStatus}`
      );
    }


    await sendWhatsApp(
`✅ *C2 Program Monitoring - Test Notification*

The WhatsApp notification service has been configured successfully.

Status: Successful

No action is required.

C2 Notification Monitoring System
Global Rubber Industries`
    );


    console.log(
      "WhatsApp test message sent successfully."
    );

  } catch (error) {

    console.error(
      "WhatsApp test failed:"
    );

    console.error(
      error.message
    );
  }
}


if (
  require.main === module
) {

  testWhatsApp();
}


module.exports = {

  startWhatsApp,

  sendWhatsApp,

  getWhatsAppAlertStatus,

  stopWhatsApp
};