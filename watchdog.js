"use strict";

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const {
  sendEmail
} = require("./email");

const {
  startWhatsApp,
  sendWhatsApp,
  getWhatsAppAlertStatus,
  stopWhatsApp
} = require("./whatsapp");

const {
  buildAlertMessage,
  buildRecoveryMessage
} = require("./message-templates");


// ============================================================
// CONFIGURATION
// ============================================================

function numberEnv(
  name,
  fallback,
  minimum
) {

  const value =
    Number(
      process.env[name] ||
      fallback
    );

  if (
    !Number.isFinite(value) ||
    value < minimum
  ) {

    throw new Error(
      `Invalid ${name}`
    );
  }

  return value;
}


const cfg = {

  monitorUrl:
    String(
      process.env.MONITOR_URL || ""
    ).trim(),

  username:
    process.env.MONITOR_USERNAME ||
    "admin",

  password:
    process.env.MONITOR_PASSWORD ||
    "",

  interval:
    numberEnv(
      "CHECK_INTERVAL_SECONDS",
      60,
      10
    ) * 1000,

  heartbeatMinutes:
    numberEnv(
      "HEARTBEAT_MAX_MINUTES",
      3,
      1
    ),

  oracleMinutes:
    numberEnv(
      "ORACLE_MAX_MINUTES",
      3,
      1
    ),

  pendingMinutes:
    numberEnv(
      "PENDING_MINUTES",
      5,
      1
    ),

  sendingMinutes:
    numberEnv(
      "SENDING_MINUTES",
      5,
      1
    ),

  cooldown:
    numberEnv(
      "ALERT_COOLDOWN_MINUTES",
      10,
      1
    ) *
    60 *
    1000
};


if (!cfg.monitorUrl) {

  throw new Error(
    "MONITOR_URL missing in .env"
  );
}


// ============================================================
// LOGGING
// ============================================================

const logDirectory =
  path.join(
    __dirname,
    "logs"
  );

fs.mkdirSync(
  logDirectory,
  {
    recursive: true
  }
);

const logFile =
  path.join(
    logDirectory,
    "monitor.log"
  );


function log(
  ...values
) {

  const line =
    `[${new Date().toISOString()}] ` +
    values
      .map(
        value => {

          if (
            typeof value ===
            "string"
          ) {

            return value;
          }

          try {

            return JSON.stringify(
              value
            );

          } catch {

            return String(
              value
            );
          }
        }
      )
      .join(" ");

  console.log(
    line
  );

  fs.appendFileSync(
    logFile,
    line + "\n",
    "utf8"
  );
}


// ============================================================
// STATE
// ============================================================

let stopping =
  false;

let baselineEstablished =
  false;

let baselineUncertainIds =
  new Set();

const activeIssues =
  new Map();

const lastAlertTimes =
  new Map();


// ============================================================
// HELPERS
// ============================================================

function authHeader() {

  const credentials =
    Buffer
      .from(
        `${cfg.username}:${cfg.password}`
      )
      .toString(
        "base64"
      );

  return (
    `Basic ${credentials}`
  );
}


function parseDate(
  value
) {

  if (!value) {

    return null;
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return null;
  }

  return date;
}


function minutesSince(
  value
) {

  const date =
    parseDate(value);

  if (!date) {

    return Infinity;
  }

  return (
    Date.now() -
    date.getTime()
  ) / 60000;
}


function recordAgeMinutes(
  record
) {

  return minutesSince(
    record.attemptAt ||
    record.discoveredAt ||
    record.row?.CREATED_DATE
  );
}


function recordId(
  record
) {

  return String(
    record.messageId ||
    record.key ||
    record.row?.BARCODE_ID ||
    "unknown"
  );
}


function createAlertId() {

  const datePart =
    new Date()
      .toISOString()
      .replace(
        /\D/g,
        ""
      )
      .slice(
        0,
        14
      );

  const randomPart =
    crypto
      .randomBytes(2)
      .toString("hex")
      .toUpperCase();

  return (
    `C2MON-${datePart}-${randomPart}`
  );
}


function canSendAgain(
  key
) {

  const previous =
    lastAlertTimes.get(
      key
    ) || 0;

  return (
    Date.now() -
    previous
    >=
    cfg.cooldown
  );
}


// ============================================================
// CALL PROGRAMMONITOR API
// ============================================================

async function getMonitorStatus() {

  const response =
    await fetch(
      cfg.monitorUrl,
      {
        headers: {
          Authorization:
            authHeader()
        },

        signal:
          AbortSignal.timeout(
            10000
          )
      }
    );

  if (!response.ok) {

    throw new Error(
      `HTTP ${response.status}`
    );
  }

  return response.json();
}


// ============================================================
// SEND EMAIL + WHATSAPP
// ============================================================

async function deliver(
  message
) {

  const results =
    await Promise.allSettled([

      sendEmail(
        message.subject,
        message.text,
        message.html
      ),

      sendWhatsApp(
        message.whatsapp
      )
    ]);

  if (
    results[0].status ===
    "fulfilled"
  ) {

    log(
      "Email notification sent."
    );

  } else {

    log(
      "Email notification failed:",
      results[0]
        .reason
        ?.message
    );
  }

  if (
    results[1].status ===
    "fulfilled"
  ) {

    log(
      "WhatsApp notification sent."
    );

  } else {

    log(
      "WhatsApp notification failed:",
      results[1]
        .reason
        ?.message
    );
  }
}


// ============================================================
// CREATE / UPDATE ISSUE
// ============================================================

async function raiseIssue(
  issue,
  status
) {

  let stored =
    activeIssues.get(
      issue.key
    );

  const isNew =
    !stored;

  if (!stored) {

    stored = {

      ...issue,

      alertId:
        createAlertId(),

      firstDetected:
        new Date()
          .toISOString()
    };

    activeIssues.set(
      issue.key,
      stored
    );

  } else {

    stored = {

      ...stored,

      ...issue
    };

    activeIssues.set(
      issue.key,
      stored
    );
  }

  if (
    !isNew &&
    !canSendAgain(issue.key)
  ) {

    return;
  }

  const message =
    buildAlertMessage({

      title:
        issue.title,

      severity:
        issue.severity,

      details:
        issue.details,

      programStatus:
        status.programStatus,

      oracleStatus:
        status.oracleStatus,

      sqlStatus:
        status.sqlStatus,

      whatsappStatus:
        status.whatsappStatus,

      pending:
        status.pending,

      sending:
        status.sending,

      uncertain:
        status.uncertain,

      alertId:
        stored.alertId
    });

  await deliver(
    message
  );

  lastAlertTimes.set(
    issue.key,
    Date.now()
  );
}


// ============================================================
// RECOVERY
// ============================================================

async function resolveIssue(
  key,
  details
) {

  const issue =
    activeIssues.get(
      key
    );

  if (!issue) {

    return;
  }

  const message =
    buildRecoveryMessage({

      title:
        issue.title,

      details,

      alertId:
        issue.alertId
    });

  await deliver(
    message
  );

  activeIssues.delete(
    key
  );

  lastAlertTimes.delete(
    key
  );
}


// ============================================================
// CURRENT SYSTEM STATUS
// ============================================================

function buildStatus(
  data
) {

  return {

    programStatus:
      "Running",

    oracleStatus:
      data.oracleError
        ? `Error: ${data.oracleError}`
        : "Connected",

    sqlStatus:
      data.sqlError
        ? `Error: ${data.sqlError}`
        : "Connected",

    whatsappStatus:
      data.ready
        ? (
            data.waStatus ||
            "Connected"
          )
        : (
            data.waStatus ||
            "Disconnected"
          ),

    pending:
      Number(
        data.counts?.pending || 0
      ),

    sending:
      Number(
        data.counts?.sending || 0
      ),

    uncertain:
      Number(
        data.counts?.uncertain || 0
      )
  };
}


// ============================================================
// CHECK ISSUES
// ============================================================

function evaluate(
  data
) {

  const issues =
    [];

  const rows =
    Array.isArray(
      data.rows
    )
      ? data.rows
      : [];


  // Oracle error
  if (
    data.oracleError
  ) {

    issues.push({

      key:
        "oracle-error",

      title:
        "Oracle Connection / Query Error",

      severity:
        "Critical",

      details:
        data.oracleError
    });
  }


  // SQL Server error
  if (
    data.sqlError
  ) {

    issues.push({

      key:
        "sql-error",

      title:
        "SQL Server Connection Error",

      severity:
        "Critical",

      details:
        data.sqlError
    });
  }


  // ProgramMonitor WhatsApp disconnected
  if (
    !data.ready
  ) {

    issues.push({

      key:
        "program-whatsapp-error",

      title:
        "ProgramMonitor WhatsApp Disconnected",

      severity:
        "Critical",

      details:
        data.waStatus ||
        "ProgramMonitor WhatsApp is not connected."
    });
  }


  // Heartbeat stale
  const heartbeatAge =
    minutesSince(
      data.lastCycle
    );

  if (
    heartbeatAge >
    cfg.heartbeatMinutes
  ) {

    issues.push({

      key:
        "heartbeat-stale",

      title:
        "ProgramMonitor Heartbeat Stale",

      severity:
        "Critical",

      details:
        `The ProgramMonitor heartbeat is ${heartbeatAge.toFixed(1)} minutes old.`
    });
  }


  // Oracle query stale
  const oracleAge =
    minutesSince(
      data.lastQuery
    );

  if (
    oracleAge >
    cfg.oracleMinutes
  ) {

    issues.push({

      key:
        "oracle-stale",

      title:
        "Oracle Data Refresh Stale",

      severity:
        "Critical",

      details:
        `The last Oracle query is ${oracleAge.toFixed(1)} minutes old.`
    });
  }


  // Pending messages too long
  const pendingRows =
    rows.filter(
      record =>
        record.status ===
          "pending"

        &&

        recordAgeMinutes(
          record
        )

        >=

        cfg.pendingMinutes
    );

  if (
    pendingRows.length > 0
  ) {

    const oldest =
      Math.max(
        ...pendingRows.map(
          record =>
            recordAgeMinutes(
              record
            )
        )
      );

    issues.push({

      key:
        "pending-stuck",

      title:
        "Pending C2 Messages Delayed",

      severity:
        "Warning",

      details:
        `${pendingRows.length} pending message(s) have remained pending for more than ${cfg.pendingMinutes} minutes. Oldest: ${oldest.toFixed(1)} minutes.`
    });
  }


  // Sending status stuck
  const sendingRows =
    rows.filter(
      record =>
        record.status ===
          "sending"

        &&

        recordAgeMinutes(
          record
        )

        >=

        cfg.sendingMinutes
    );

  if (
    sendingRows.length > 0
  ) {

    const oldest =
      Math.max(
        ...sendingRows.map(
          record =>
            recordAgeMinutes(
              record
            )
        )
      );

    issues.push({

      key:
        "sending-stuck",

      title:
        "C2 Message Sending Stalled",

      severity:
        "Critical",

      details:
        `${sendingRows.length} message(s) have remained in sending status for more than ${cfg.sendingMinutes} minutes. Oldest: ${oldest.toFixed(1)} minutes.`
    });
  }


  // Uncertain baseline
  const uncertainRecords =
    rows.filter(
      record =>
        record.status ===
          "uncertain"
    );

  const currentUncertainIds =
    new Set(
      uncertainRecords.map(
        recordId
      )
    );

  if (
    !baselineEstablished
  ) {

    baselineUncertainIds =
      currentUncertainIds;

    baselineEstablished =
      true;

    log(
      "Uncertain baseline established:",
      baselineUncertainIds.size
    );

  } else {

    const newUncertain =
      uncertainRecords.filter(
        record =>
          !baselineUncertainIds.has(
            recordId(record)
          )
      );

    if (
      newUncertain.length > 0
    ) {

      const ids =
        newUncertain
          .slice(
            0,
            10
          )
          .map(
            recordId
          )
          .join(
            ", "
          );

      issues.push({

        key:
          "new-uncertain",

        title:
          "New C2 Message Requires Verification",

        severity:
          "Warning",

        details:
          `${newUncertain.length} new C2 message(s) entered uncertain status. Message IDs: ${ids}`
      });
    }
  }

  return issues;
}


// ============================================================
// ONE CHECK
// ============================================================

async function checkOnce() {

  let data;

  try {

    data =
      await getMonitorStatus();

  } catch (error) {

    const issue = {

      key:
        "program-unreachable",

      title:
        "C2 ProgramMonitor / Server Unreachable",

      severity:
        "Critical",

      details:
        `Unable to reach ${cfg.monitorUrl}. ${error.message}`
    };

    const status = {

      programStatus:
        "Unreachable",

      oracleStatus:
        "Unknown",

      sqlStatus:
        "Unknown",

      whatsappStatus:
        "Unknown",

      pending:
        0,

      sending:
        0,

      uncertain:
        0
    };

    await raiseIssue(
      issue,
      status
    );

    log(
      "ProgramMonitor unreachable:",
      error.message
    );

    return;
  }


  await resolveIssue(
    "program-unreachable",
    "The C2 ProgramMonitor API is reachable again."
  );


  const status =
    buildStatus(
      data
    );


  log(
    "ProgramMonitor reachable.",
    {
      ready:
        data.ready,

      waStatus:
        data.waStatus,

      oracleError:
        data.oracleError,

      sqlError:
        data.sqlError,

      counts:
        data.counts,

      lastQuery:
        data.lastQuery,

      lastCycle:
        data.lastCycle
    }
  );


  const issues =
    evaluate(
      data
    );


  const currentKeys =
    new Set(
      issues.map(
        issue =>
          issue.key
      )
    );


  for (
    const issue
    of issues
  ) {

    await raiseIssue(
      issue,
      status
    );
  }


  const issueTypes = [

    "oracle-error",

    "sql-error",

    "program-whatsapp-error",

    "heartbeat-stale",

    "oracle-stale",

    "pending-stuck",

    "sending-stuck",

    "new-uncertain"
  ];


  for (
    const key
    of issueTypes
  ) {

    if (
      activeIssues.has(
        key
      )

      &&

      !currentKeys.has(
        key
      )
    ) {

      await resolveIssue(
        key,
        "The issue is no longer present in the latest monitoring check."
      );
    }
  }
}


// ============================================================
// START
// ============================================================

async function main() {

  log(
    "Starting C2 Program Monitoring System."
  );


  // Start WhatsApp first
  try {

    await startWhatsApp();

    log(
      "WhatsApp alert sender initialization completed."
    );

  } catch (error) {

    log(
      "WhatsApp alert sender startup error:",
      error.message
    );
  }


  // Wait up to 60 seconds until WhatsApp becomes ready
  let whatsappReady =
    false;


  for (
    let attempt = 1;
    attempt <= 60;
    attempt++
  ) {

    const whatsappStatus =
      getWhatsAppAlertStatus();


    if (
      whatsappStatus.ready
    ) {

      whatsappReady =
        true;

      log(
        "WhatsApp alert sender ready."
      );

      break;
    }


    if (
      attempt === 1 ||
      attempt % 10 === 0
    ) {

      log(
        `Waiting for WhatsApp alert sender... (${attempt}/60)`,
        whatsappStatus.status
      );
    }


    await new Promise(
      resolve =>
        setTimeout(
          resolve,
          1000
        )
    );
  }


  if (
    !whatsappReady
  ) {

    const whatsappStatus =
      getWhatsAppAlertStatus();

    log(
      "WhatsApp alert sender is not ready after 60 seconds. Monitoring will continue and email alerts will still work.",
      whatsappStatus.status
    );
  }


  // First monitoring check
  await checkOnce();


  // Continue monitoring
  setInterval(

    () => {

      if (
        stopping
      ) {

        return;
      }

      checkOnce()
        .catch(
          error => {

            log(
              "Monitoring cycle error:",
              error.message
            );
          }
        );

    },

    cfg.interval
  );
}


// ============================================================
// SHUTDOWN
// ============================================================

async function stop() {

  if (stopping) {

    return;
  }

  stopping =
    true;

  log(
    "Stopping C2 Program Monitoring System."
  );

  await stopWhatsApp();

  process.exit(0);
}


process.on(
  "SIGINT",
  stop
);

process.on(
  "SIGTERM",
  stop
);

process.on(
  "uncaughtException",
  error => {

    log(
      "Uncaught exception:",
      error.stack ||
      error.message
    );

    process.exit(1);
  }
);

process.on(
  "unhandledRejection",
  error => {

    log(
      "Unhandled rejection:",
      error?.stack ||
      error?.message ||
      String(error)
    );

    process.exit(1);
  }
);


main();