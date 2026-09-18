import nodemailer from "nodemailer";

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

function clean(v, max = 5000) {
  return String(v ?? "").replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, max);
}

function json(data, status = 200, headers = {}) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store", ...headers }
  });
}

function corsHeaders(origin) {
  const allowed = new Set(["https://enervia.az", "https://www.enervia.az"]);
  return allowed.has(origin) ? {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  } : {};
}

export default {
  async fetch(request) {
    const origin = request.headers.get("origin") || "";
    const headers = corsHeaders(origin);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }

    if (request.method !== "POST") {
      return json({ ok: false, error: "Method not allowed" }, 405, headers);
    }

    if (origin && !headers["Access-Control-Allow-Origin"]) {
      return json({ ok: false, error: "Forbidden origin" }, 403, headers);
    }

    const ip = (request.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim();
    const now = Date.now();
    globalThis.__rfqRate = globalThis.__rfqRate || new Map();
    const previous = globalThis.__rfqRate.get(ip) || 0;

    if (now - previous < 60000) {
      return json({ ok: false, error: "Please wait before submitting another RFQ." }, 429, headers);
    }
    globalThis.__rfqRate.set(ip, now);

    let data;
    try {
      data = await request.formData();
    } catch (e) {
      console.error("RFQ formData error", e);
      return json({ ok: false, error: "The RFQ form data could not be read. Please try again without an attachment." }, 400, headers);
    }

    if (clean(data.get("website"), 200)) {
      return json({ ok: true }, 200, headers);
    }

    const company = clean(data.get("company"), 200);
    const name = clean(data.get("name"), 200);
    const email = clean(data.get("email"), 320);
    const phone = clean(data.get("phone"), 100);
    const industry = clean(data.get("industry"), 120);
    const type = clean(data.get("type"), 120);
    const details = clean(data.get("details"), 12000);

    if (!company || !name || !details || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ ok: false, error: "Please complete the required fields." }, 400, headers);
    }

    const fileValue = data.get("file");
    let attachment = null;

    if (fileValue && typeof fileValue === "object" && "name" in fileValue) {
      const file = fileValue;
      if (!file.name || file.size === 0) {
        attachment = null;
      } else {
        const ext = (file.name.split(".").pop() || "").toLowerCase();
        if (!ALLOWED_EXT.has(ext) || !ALLOWED_MIME.has(file.type)) {
          return json({ ok: false, error: "This file type is not accepted." }, 400, headers);
        }
        if (file.size > MAX_FILE_SIZE) {
          return json({ ok: false, error: "Maximum attachment size is 10 MB." }, 400, headers);
        }
        const buffer = Buffer.from(await file.arrayBuffer());
        attachment = { filename: file.name.replace(/[^a-zA-Z0-9._ -]/g, "_"), content: buffer };
      }
    }

    const n = new Date();
    const rfqId = "EN-" + n.toISOString().slice(0, 10).replace(/-/g, "") + "-" +
      Math.random().toString(36).slice(2, 7).toUpperCase();

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "mail.privateemail.com",
      port: Number(process.env.SMTP_PORT || 465),
      secure: String(process.env.SMTP_SECURE || "true") === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000
    });

    const body = [
      "ENERVIA RFQ",
      "==============================",
      "RFQ ID: " + rfqId,
      "Submitted: " + n.toISOString(),
      "",
      "COMPANY",
      "Company: " + company,
      "Contact: " + name,
      "Email: " + email,
      "Phone: " + phone,
      "Industry: " + industry,
      "Requirement type: " + type,
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

      return json({ ok: true, rfqId }, 200, headers);
    } catch (e) {
      console.error("RFQ mail error", e);
      return json({ ok: false, error: "We could not send the RFQ right now. Please try again or email sales@enervia.az." }, 500, headers);
    }
  }
};
