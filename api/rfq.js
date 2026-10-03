import nodemailer from "nodemailer";
import formidable from "formidable";
import fs from "fs";
import { insertRfq } from "../lib/supabase.js";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_EXT = new Set(["pdf", "xlsx", "xls", "docx", "doc", "jpg", "jpeg", "png"]);
const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "image/jpeg",
  "image/png"
]);

function text(v) {
  return Array.isArray(v) ? String(v[0] || "") : String(v || "");
}

function clean(v, max = 5000) {
  return text(v).replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, max);
}

export default async function handler(req, res) {
  const origin = req.headers.origin || "";
  const allowedOrigins = new Set(["https://enervia.az", "https://www.enervia.az"]);
  if (allowedOrigins.has(origin)) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Credentials", "false");
  res.setHeader("Vary", "Origin");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
  if (origin && !allowedOrigins.has(origin)) return res.status(403).json({ ok: false, error: "Forbidden origin" });

  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
  const now = Date.now();
  globalThis.__rfqRate = globalThis.__rfqRate || new Map();
  const previous = globalThis.__rfqRate.get(ip) || 0;
  if (now - previous < 60000) return res.status(429).json({ ok: false, error: "Please wait before submitting another RFQ." });
  globalThis.__rfqRate.set(ip, now);

  const form = formidable({
    multiples: false,
    maxFiles: 1,
    maxFileSize: MAX_FILE_SIZE,
    allowEmptyFiles: true,
    keepExtensions: true
  });

  let fields, files;
  try {
    [fields, files] = await form.parse(req);
  } catch (e) {
    console.error("RFQ multipart parse error", e);
    const message = String(e?.message || "");
    if (/maxFileSize|larger than|maxFiles|too many files/i.test(message)) {
      return res.status(400).json({ ok: false, error: "The attachment is too large or more than one file was selected. Maximum size is 10 MB." });
    }
    return res.status(400).json({ ok: false, error: "The RFQ form data could not be read. Please try again without an attachment." });
  }

  if (clean(fields.website, 200)) return res.status(200).json({ ok: true });

  const language = clean(fields.language, 10) || "en";
  const company = clean(fields.company, 200);
  const name = clean(fields.name, 200);
  const email = clean(fields.email, 320);
  const phone = clean(fields.phone, 100);
  const industry = clean(fields.industry, 120);
  const type = clean(fields.type, 120);
  const projectName = clean(fields.projectName, 250);
  const deliveryLocation = clean(fields.deliveryLocation, 250);
  const requiredBy = clean(fields.requiredBy, 40);
  const currency = clean(fields.currency, 20) || "AZN";
  const priority = clean(fields.priority, 30) || "Normal";
  const details = clean(fields.details, 12000);

  if (!company || !name || !details || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ ok: false, error: "Please complete the required fields." });
  }

  const file = Array.isArray(files.file) ? files.file[0] : files.file;
  let attachment;
  if (file && file.filepath && file.originalFilename) {
    const ext = (file.originalFilename.split(".").pop() || "").toLowerCase();
    if (!ALLOWED_EXT.has(ext) || (file.mimetype && !ALLOWED_MIME.has(file.mimetype))) {
      return res.status(400).json({ ok: false, error: "This file type is not accepted." });
    }
    if (file.size > MAX_FILE_SIZE) return res.status(400).json({ ok: false, error: "Maximum attachment size is 10 MB." });
    attachment = {
      filename: file.originalFilename.replace(/[^a-zA-Z0-9._ -]/g, "_"),
      path: file.filepath
    };
  }

  const n = new Date();
  const rfqId = "EN-" + n.toISOString().slice(0, 10).replace(/-/g, "") + "-" +
    Math.random().toString(36).slice(2, 7).toUpperCase();

  const record = {
    version: "1.0",
    rfqId,
    status: "NEW",
    submittedAt: n.toISOString(),
    language,
    company,
    contactName: name,
    email,
    phone,
    industry,
    requirementType: type,
    projectName,
    deliveryLocation,
    requiredBy: requiredBy || null,
    currency,
    priority,
    details,
    attachment: attachment ? { filename: attachment.filename } : null
  };

  try {
    await insertRfq(record);
  } catch (e) {
    console.error("RFQ database error", e);
    if (attachment?.path) {
      try { fs.unlinkSync(attachment.path); } catch {}
    }
    return res.status(500).json({ ok: false, error: "The RFQ could not be saved. Please try again." });
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "mail.privateemail.com",
    port: Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE || "true") === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
  });

  const body = [
    "ENERVIA RFQ 2.0",
    "==============================",
    "RFQ ID: " + rfqId,
    "Status: NEW",
    "Submitted: " + n.toISOString(),
    "Language: " + language,
    "",
    "COMPANY",
    "Company: " + company,
    "Contact: " + name,
    "Email: " + email,
    "Phone: " + phone,
    "Industry: " + industry,
    "Requirement type: " + type,
    "Project: " + (projectName || "Not specified"),
    "Delivery location: " + (deliveryLocation || "Not specified"),
    "Required by: " + (requiredBy || "Not specified"),
    "Currency: " + currency,
    "Priority: " + priority,
    "",
    "REQUIREMENT / SPECIFICATION",
    details,
    "",
    "Attachment: " + (attachment ? attachment.filename : "None")
  ].join("\n");

  try {
    await transporter.sendMail({
      from: `"Enervia RFQ" <${process.env.SMTP_USER}>`,
      to: process.env.RFQ_TO || "sales@enervia.az",
      replyTo: email,
      subject: `RFQ ${rfqId} | ${company}`,
      text: body,
      attachments: attachment ? [attachment] : []
    });
    return res.status(200).json({ ok: true, rfqId, status: record.status });
  } catch (e) {
    console.error("RFQ mail error", e);
    return res.status(500).json({ ok: false, error: "We could not send the RFQ right now. Please try again or email sales@enervia.az." });
  } finally {
    if (attachment?.path) {
      try { fs.unlinkSync(attachment.path); } catch {}
    }
  }
}
