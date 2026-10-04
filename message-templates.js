"use strict";


function getTimeZone() {

  return (
    process.env.TIME_ZONE ||
    "Asia/Colombo"
  );
}


function formatDateTime(
  value = new Date()
) {

  const date =
    value instanceof Date
      ? value
      : new Date(value);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return "Unknown";
  }


  return date.toLocaleString(
    "en-GB",
    {

      timeZone:
        getTimeZone(),

      year:
        "numeric",

      month:
        "2-digit",

      day:
        "2-digit",

      hour:
        "2-digit",

      minute:
        "2-digit",

      second:
        "2-digit",

      hour12:
        true
    }
  );
}


function escapeHtml(value) {

  return String(
    value ?? ""
  )

    .replace(
      /&/g,
      "&amp;"
    )

    .replace(
      /</g,
      "&lt;"
    )

    .replace(
      />/g,
      "&gt;"
    )

    .replace(
      /"/g,
      "&quot;"
    );
}


// ============================================================
// ALERT
// ============================================================

function buildAlertMessage({

  title,

  severity,

  details,

  programStatus,

  oracleStatus,

  sqlStatus,

  whatsappStatus,

  pending,

  sending,

  uncertain,

  alertId

}) {

  const detectedAt =
    formatDateTime();


  const subject =

    `C2 Program Monitoring Alert - ${title}`;


  const text = `Dear Team,

An issue has been detected in the C2 notification monitoring system.

Issue Summary
-------------
Severity           : ${severity}
Issue              : ${title}
Detected Time      : ${detectedAt}
Program Status     : ${programStatus}
Oracle Status      : ${oracleStatus}
SQL Server Status  : ${sqlStatus}
WhatsApp Status    : ${whatsappStatus}
Pending Messages   : ${pending}
Sending Messages   : ${sending}
Needs Verification : ${uncertain}
Alert ID           : ${alertId}

Details
-------
${details}

Recommended Action
------------------
Please verify the C2 ProgramMonitor service, server connectivity, database connections, and WhatsApp session as applicable.

This is an automated system notification.

Regards,
C2 Notification Monitoring System
Global Rubber Industries`;


  const whatsapp = `🚨 *C2 Program Monitoring Alert*

*Severity:* ${severity}

*Issue:* ${title}

*Detected:* ${detectedAt}

*Alert ID:* ${alertId}

*System Status*

Program: ${programStatus}

Oracle: ${oracleStatus}

SQL Server: ${sqlStatus}

WhatsApp: ${whatsappStatus}

*Message Status*

Pending: ${pending}

Sending: ${sending}

Needs Verification: ${uncertain}

*Details*

${details}

Please check the C2 notification service.`;


  const html = `

<div style="
  font-family:Segoe UI,Arial,sans-serif;
  max-width:760px;
  margin:auto;
  color:#1f2937;
">

  <div style="
    background:#8b1e2d;
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
      Program Monitoring Alert
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
      An issue has been detected in the
      C2 notification monitoring system.
    </p>


    <table style="
      width:100%;
      border-collapse:collapse;
      margin:18px 0;
    ">

      <tr>
        <td><b>Severity</b></td>
        <td>${escapeHtml(severity)}</td>
      </tr>

      <tr>
        <td><b>Issue</b></td>
        <td>${escapeHtml(title)}</td>
      </tr>

      <tr>
        <td><b>Detected Time</b></td>
        <td>${escapeHtml(detectedAt)}</td>
      </tr>

      <tr>
        <td><b>Program Status</b></td>
        <td>${escapeHtml(programStatus)}</td>
      </tr>

      <tr>
        <td><b>Oracle Status</b></td>
        <td>${escapeHtml(oracleStatus)}</td>
      </tr>

      <tr>
        <td><b>SQL Server Status</b></td>
        <td>${escapeHtml(sqlStatus)}</td>
      </tr>

      <tr>
        <td><b>WhatsApp Status</b></td>
        <td>${escapeHtml(whatsappStatus)}</td>
      </tr>

      <tr>
        <td><b>Pending Messages</b></td>
        <td>${pending}</td>
      </tr>

      <tr>
        <td><b>Sending Messages</b></td>
        <td>${sending}</td>
      </tr>

      <tr>
        <td><b>Needs Verification</b></td>
        <td>${uncertain}</td>
      </tr>

      <tr>
        <td><b>Alert ID</b></td>
        <td>${escapeHtml(alertId)}</td>
      </tr>

    </table>


    <div style="
      background:#f8fafc;
      border-left:4px solid #8b1e2d;
      padding:14px 16px;
      margin:18px 0;
    ">

      <b>Details</b>

      <br>

      ${escapeHtml(details)}

    </div>


    <p>

      <b>Recommended Action</b>

      <br>

      Please verify the C2 ProgramMonitor service,
      server connectivity, database connections,
      and WhatsApp session as applicable.

    </p>


    <p style="
      color:#6b7280;
      font-size:13px;
    ">

      This is an automated system notification.

    </p>


    <p style="margin-top:28px;">

      Regards,

      <br>

      <b>
        C2 Notification Monitoring System
      </b>

      <br>

      Global Rubber Industries

    </p>

  </div>

</div>
`;


  return {

    subject,

    text,

    html,

    whatsapp
  };
}


// ============================================================
// RECOVERY
// ============================================================

function buildRecoveryMessage({

  title,

  details,

  alertId

}) {

  const recoveredAt =
    formatDateTime();


  const subject =

    `C2 Program Monitoring - Service Restored - ${title}`;


  const text = `Dear Team,

The previously detected C2 notification monitoring issue has been resolved.

Recovery Summary
----------------
Issue          : ${title}
Recovered Time : ${recoveredAt}
Alert ID       : ${alertId}

Details
-------
${details}

The C2 notification service is operating normally again.

This is an automated system notification.

Regards,
C2 Notification Monitoring System
Global Rubber Industries`;


  const whatsapp = `✅ *C2 Program Monitoring - Service Restored*

*Issue:* ${title}

*Recovered:* ${recoveredAt}

*Alert ID:* ${alertId}

${details}

The C2 notification service is operating normally again.`;


  const html = `

<div style="
  font-family:Segoe UI,Arial,sans-serif;
  max-width:760px;
  margin:auto;
  color:#1f2937;
">

  <div style="
    background:#166534;
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
      Service Restored
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
      The previously detected C2 notification
      monitoring issue has been resolved.
    </p>


    <table style="
      width:100%;
      border-collapse:collapse;
      margin:18px 0;
    ">

      <tr>

        <td>
          <b>Issue</b>
        </td>

        <td>
          ${escapeHtml(title)}
        </td>

      </tr>

      <tr>

        <td>
          <b>Recovered Time</b>
        </td>

        <td>
          ${escapeHtml(recoveredAt)}
        </td>

      </tr>

      <tr>

        <td>
          <b>Alert ID</b>
        </td>

        <td>
          ${escapeHtml(alertId)}
        </td>

      </tr>

    </table>


    <p>
      ${escapeHtml(details)}
    </p>


    <p>

      The C2 notification service is
      operating normally again.

    </p>


    <p style="
      color:#6b7280;
      font-size:13px;
    ">

      This is an automated system notification.

    </p>


    <p style="margin-top:28px;">

      Regards,

      <br>

      <b>
        C2 Notification Monitoring System
      </b>

      <br>

      Global Rubber Industries

    </p>

  </div>

</div>
`;


  return {

    subject,

    text,

    html,

    whatsapp
  };
}


module.exports = {

  formatDateTime,

  buildAlertMessage,

  buildRecoveryMessage
};