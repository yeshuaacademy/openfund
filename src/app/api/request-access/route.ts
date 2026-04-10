import config from "@/config";
import { resendService } from "@/libs/resend";
import {
  encodeRequestData,
  generateActionToken,
  getAdminEmail,
  getAppUrl,
  type RequestAccessPayload,
} from "@/utils/request-access";
import { NextResponse, type NextRequest } from "next/server";

const normalize = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const normalizeEmail = (value: unknown) => normalize(value).toLowerCase();

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<RequestAccessPayload> & {
      role?: string;
    };

    const name = normalize(body.name);
    const email = normalizeEmail(body.email);
    const reason = normalize(body.reason);
    const role = normalize(body.role);

    if (!name || !email || !reason) {
      return NextResponse.json(
        { error: "Name, email, and reason are required." },
        { status: 400 }
      );
    }

    const adminEmail = getAdminEmail();
    if (!adminEmail) {
      console.error("ADMIN_EMAIL is not configured");
      return NextResponse.json(
        { error: "Request access is not available right now." },
        { status: 500 }
      );
    }

    const encodedPayload = encodeRequestData({
      name,
      email,
      role: role || undefined,
      reason,
    });

    const appUrl = getAppUrl(new URL(request.url).origin);
    const approveToken = generateActionToken(email, "approve", encodedPayload);
    const denyToken = generateActionToken(email, "deny", encodedPayload);

    const approvalLink = `${appUrl}/api/request-access/approve?email=${encodeURIComponent(
      email
    )}&token=${approveToken}&data=${encodeURIComponent(encodedPayload)}`;
    const denyLink = `${appUrl}/api/request-access/deny?email=${encodeURIComponent(
      email
    )}&token=${denyToken}&data=${encodeURIComponent(encodedPayload)}`;

    const fromAddress =
      process.env.REQUEST_ACCESS_FROM ?? config.resend.fromAdmin;

    const plainText = [
      "A new Yeshua Academy Finance access request has been submitted.",
      `Name: ${name}`,
      `Email: ${email}`,
      role ? `Role: ${role}` : "",
      `Reason: ${reason}`,
      "",
      `Approve: ${approvalLink}`,
      `Deny: ${denyLink}`,
    ]
      .filter(Boolean)
      .join("\n");

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.5; color: #0f172a;">
        <h2 style="margin-bottom: 16px;">New Yeshua Academy Finance access request</h2>
        <p style="margin-bottom: 12px;">A visitor submitted the request form. Details:</p>
        <ul style="padding-left: 20px; margin-bottom: 16px;">
          <li><strong>Name:</strong> ${name}</li>
          <li><strong>Email:</strong> ${email}</li>
          ${
            role
              ? `<li><strong>Role:</strong> ${role}</li>`
              : "<!-- no role provided -->"
          }
        </ul>
        <p style="margin-bottom: 20px;"><strong>Reason for access:</strong><br/>${reason}</p>
        <div style="display: flex; gap: 12px; margin-bottom: 12px;">
          <a href="${approvalLink}" style="flex: 1; text-align: center; padding: 12px 16px; border-radius: 999px; background: linear-gradient(90deg,#5D5AF6,#6E62FF,#24C4FF); color: #fff; text-decoration: none; font-weight: 600;">Approve access</a>
        </div>
        <div style="display: flex; gap: 12px;">
          <a href="${denyLink}" style="flex: 1; text-align: center; padding: 12px 16px; border-radius: 999px; background: #f1f5f9; color: #0f172a; text-decoration: none; font-weight: 600;">Deny access</a>
        </div>
      </div>
    `;

    await resendService.sendEmail(
      {
        from: fromAddress,
        replyTo: email,
        to: [adminEmail],
        subject: "New Yeshua Academy Finance access request",
        text: plainText,
        html,
      },
      "request access notification"
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Request access submission failed", error);
    return NextResponse.json(
      { error: "Unable to submit request right now." },
      { status: 500 }
    );
  }
}
