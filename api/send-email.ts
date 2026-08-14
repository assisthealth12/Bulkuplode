import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Vercel Serverless Function: /api/send-email
 *
 * Receives student data + base64-encoded PDF from the frontend,
 * then calls the MSG91 Email API to send it.
 * The MSG91 Auth Key is stored as a Vercel env var (never exposed to the browser).
 *
 * MSG91 requires a template_id. We pass dynamic variables (studentName, className)
 * into the template using {{studentName}} and {{className}} placeholders.
 */

const MSG91_EMAIL_ENDPOINT = "https://control.msg91.com/api/v5/email/send";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers for frontend calls
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authKey = process.env.MSG91_AUTH_KEY;
  if (!authKey) {
    return res.status(500).json({ error: "MSG91_AUTH_KEY not configured on server" });
  }

  const templateId = process.env.MSG91_TEMPLATE_ID;
  if (!templateId) {
    return res.status(500).json({ error: "MSG91_TEMPLATE_ID not configured on server" });
  }

  const senderEmail = process.env.SENDER_EMAIL || "health@assisthealth.in";
  const senderName = process.env.SENDER_NAME || "AssistHealth";
  const domain = process.env.MSG91_DOMAIN || senderEmail.split("@")[1];

  const { to, studentName, className, pdfBase64, fileName } = req.body;

  if (!to || !pdfBase64) {
    return res.status(400).json({ error: "Missing required fields: to, pdfBase64" });
  }

  try {
    const payload = {
      recipients: [
        {
          to: [{ email: to, name: studentName || "Parent" }],
          variables: {
            studentName: studentName || "Student",
            className: className || "Class",
          },
        },
      ],
      from: { email: senderEmail, name: senderName },
      domain: domain,
      template_id: templateId,
      attachments: [
        {
          filePath: `data:application/pdf;base64,${pdfBase64}`,
          fileName: fileName || `${studentName || "student"}_health_report.pdf`,
        },
      ],
    };

    const response = await fetch(MSG91_EMAIL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authkey: authKey,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("MSG91 error:", data);
      return res.status(response.status).json({
        error: "MSG91 API error",
        details: data,
      });
    }

    return res.status(200).json({ success: true, data });
  } catch (err: any) {
    console.error("Send email error:", err);
    return res.status(500).json({ error: err.message || "Unknown error" });
  }
}
