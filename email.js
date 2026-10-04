"use strict";

require("dotenv").config();

const nodemailer = require("nodemailer");


function required(name) {

  const value =
    String(
      process.env[name] || ""
    ).trim();

  if (!value) {

    throw new Error(
      `Missing ${name} in .env`
    );
  }

  return value;
}


const transporter =
  nodemailer.createTransport({

    host:
      required("SMTP_HOST"),

    port:
      Number(
        process.env.SMTP_PORT || 587
      ),

    secure:
      Number(
        process.env.SMTP_PORT || 587
      ) === 465,

    auth: {

      user:
        required("SMTP_USER"),

      pass:
        required("SMTP_PASSWORD")
    }
  });


async function sendEmail(
  subject,
  text,
  html = null
) {

  return transporter.sendMail({

    from:
      required("ALERT_FROM"),

    to:
      required("ALERT_TO"),

    subject,

    text,

    ...(html
      ? { html }
      : {})
  });
}


// ============================================================
// EMAIL TEST
// ============================================================

async function testEmail() {

  try {

    console.log(
      "Checking email configuration..."
    );

    await transporter.verify();

    console.log(
      "SMTP connection successful."
    );


    const now =
      new Date()
        .toLocaleString();


    const text = `Dear Team,

This is a test notification from the C2 Program Monitoring System.

The email notification service has been configured successfully.

Test Time : ${now}
Status    : Successful

No action is required.

Regards,
C2 Notification Monitoring System
Global Rubber Industries`;


    const html = `

<div style="
  font-family:Segoe UI,Arial,sans-serif;
  max-width:720px;
  margin:auto;
  color:#1f2937;
">

  <div style="
    background:#12345b;
    color:white;
    padding:20px 24px;
    border-radius:8px 8px 0 0;
  ">

    <div style="
      font-size:13px;
      letter-spacing:1px;
    ">
      C2 NOTIFICATION MONITORING SYSTEM
    </div>

    <h2 style="margin:6px 0 0;">
      Test Notification
    </h2>

  </div>


  <div style="
    border:1px solid #dbe3ec;
    border-top:0;
    padding:24px;
    border-radius:0 0 8px 8px;
  ">

    <p>Dear Team,</p>

    <p>
      This is a test notification from the
      <b>C2 Program Monitoring System</b>.
    </p>

    <p>
      The email notification service has been
      configured successfully.
    </p>


    <table style="
      border-collapse:collapse;
      margin:18px 0;
    ">

      <tr>

        <td style="padding:6px 18px 6px 0;">
          <b>Test Time</b>
        </td>

        <td>
          ${now}
        </td>

      </tr>

      <tr>

        <td style="padding:6px 18px 6px 0;">
          <b>Status</b>
        </td>

        <td>
          Successful
        </td>

      </tr>

    </table>


    <p>
      No action is required.
    </p>


    <p style="margin-top:28px;">

      Regards,<br>

      <b>
        C2 Notification Monitoring System
      </b>

      <br>

      Global Rubber Industries

    </p>

  </div>

</div>
`;


    await sendEmail(

      "C2 Program Monitoring - Test Notification",

      text,

      html
    );


    console.log(
      "Test email sent successfully."
    );

  } catch (error) {

    console.error(
      "Email test failed:"
    );

    console.error(
      error.message
    );

    process.exitCode = 1;
  }
}


if (require.main === module) {

  testEmail();
}


module.exports = {
  sendEmail
};