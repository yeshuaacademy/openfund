import config from "@/config";
import { resendService } from "@/libs/resend";
import { AUTH_ENABLED } from "@/utils/auth";
import {
  decodeRequestData,
  getAppUrl,
  type RequestAccessPayload,
  verifyActionToken,
} from "@/utils/request-access";
import { NextResponse, type NextRequest } from "next/server";

type ClerkClient = typeof import("@clerk/nextjs/server").clerkClient;

let clerkClient: ClerkClient | null = null;
if (AUTH_ENABLED) {
  clerkClient = require("@clerk/nextjs/server").clerkClient;
}

const redirectTo = (url: string, path: string) => {
  const target = new URL(path, url);
  return NextResponse.redirect(target);
};

const buildFriendlyName = (payload: RequestAccessPayload | null) => {
  if (payload?.name) {
    return payload.name;
  }
  return "there";
};

export async function GET(
  request: NextRequest,
  { params }: { params: { action: string } }
) {
  const { searchParams } = request.nextUrl;
  const email = searchParams.get("email")?.trim().toLowerCase();
  const token = searchParams.get("token");
  const data = searchParams.get("data") ?? "";
  const payload = decodeRequestData(data);
  if (params.action !== "approve" && params.action !== "deny") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const action = params.action as "approve" | "deny";

  if (!email || !token || !data || !payload || payload.email !== email) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!verifyActionToken(email, action, data, token)) {
    return NextResponse.json({ error: "Invalid token." }, { status: 400 });
  }

  const appUrl = getAppUrl(new URL(request.url).origin);
  const fromAddress =
    process.env.REQUEST_ACCESS_FROM ?? config.resend.fromAdmin;

  if (action === "approve") {
    if (clerkClient) {
      try {
        await clerkClient.invitations.createInvitation({
          emailAddress: email,
          redirectUrl: `${appUrl}/sign-up`,
          publicMetadata: { approved: true },
        });
      } catch (error) {
        console.error("Failed to create Clerk invitation", error);
        return NextResponse.json(
          { error: "Unable to process approval." },
          { status: 500 }
        );
      }
    } else {
      console.warn("Clerk not configured; skipping invitation for", email);
    }

    try {
      await resendService.sendEmail(
        {
          from: fromAddress,
          to: [email],
          subject: "Your Finance Admin access has been approved",
          replyTo: process.env.ADMIN_EMAIL,
          text: `Hi ${buildFriendlyName(
            payload
          )},\n\nYour access request has been approved. You can finish creating your account at ${appUrl}/sign-up.\n\n— Finance Admin`,
          html: `
            <div style="font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; line-height:1.6; color:#0f172a;">
              <p>Hi ${buildFriendlyName(payload)},</p>
              <p>Your Finance Admin access request has been approved. Use the link below to complete sign-up:</p>
              <p><a href="${appUrl}/sign-up" style="color:#5D5AF6; font-weight:600;">Complete sign-up</a></p>
              <p>You can now continue into Yeshua Academy Finance.<br/>— Finance Admin</p>
            </div>
          `,
        },
        "request access approval notice"
      );
    } catch (error) {
      console.error("Failed to send approval email", error);
    }

    return redirectTo(appUrl, "/approval-success");
  }

  try {
    await resendService.sendEmail(
      {
        from: fromAddress,
        to: [email],
        subject: "Finance Admin access decision",
        text: `Your request has been denied, if you feel that this is the wrong decision please email us at info@yeshua.academy.`,
        html: `
          <div style="font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; line-height:1.6; color:#0f172a;">
            <p>Your request has been denied, if you feel that this is the wrong decision please email us at <a href="mailto:info@yeshua.academy">info@yeshua.academy</a>.</p>
          </div>
        `,
      },
      "request access denial notice"
    );
  } catch (error) {
    console.error("Failed to send denial email", error);
  }

  return redirectTo(appUrl, "/approval-denied");
}
