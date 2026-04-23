import { Heading, Text } from "@react-email/components";
import { CTAButton } from "./shared/cta-button";
import { Footer } from "./shared/footer";
import { Layout } from "./shared/layout";

export interface VerificationEmailProps {
  name?: string;
  url: string;
}

const headingStyle = {
  fontSize: "20px",
  margin: "0 0 16px",
};

const paragraphStyle = {
  lineHeight: "1.5",
  margin: "0 0 16px",
};

const linkHintStyle = {
  color: "#555555",
  fontSize: "13px",
  lineHeight: "1.5",
  margin: "0 0 8px",
};

const linkStyle = {
  color: "#555555",
  fontSize: "13px",
  margin: "0 0 24px",
  wordBreak: "break-all" as const,
};

export const subject = "Verify your email for omi";

export function renderText({ url, name }: VerificationEmailProps): string {
  const greeting = name ? `Hi ${name},` : "Hi,";
  return `${greeting}\n\nVerify your email for omi by opening the link below:\n\n${url}\n\nIf you didn't sign up, you can safely ignore this message.`;
}

export function VerificationEmail({ url, name }: VerificationEmailProps) {
  const greeting = name ? `Hi ${name},` : "Hi,";
  return (
    <Layout preview="Verify your email for omi">
      <Heading style={headingStyle}>Verify your email</Heading>
      <Text style={paragraphStyle}>{greeting}</Text>
      <Text style={paragraphStyle}>
        Tap the button below to verify your email address and finish setting up
        your omi account.
      </Text>
      <Text style={{ margin: "0 0 24px" }}>
        <CTAButton href={url}>Verify email</CTAButton>
      </Text>
      <Text style={linkHintStyle}>Or paste this link into your browser:</Text>
      <Text style={linkStyle}>{url}</Text>
      <Footer>
        If you didn't sign up for omi, you can safely ignore this email.
      </Footer>
    </Layout>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Render the verification email as plain HTML.
 *
 * We can't use `@react-email/render` or `react-dom/server` here: Convex's V8
 * isolate lacks `MessageChannel` (needed by react-dom) and the react-email
 * edge build uses dynamic imports Convex doesn't support. The JSX component
 * above still exists for the `email dev` preview, which runs in Node.
 */
// biome-ignore lint/suspicious/useAwait: Kept async to preserve the callsite contract.
export async function renderVerificationEmail(
  props: VerificationEmailProps
): Promise<{ subject: string; html: string; text: string }> {
  const greeting = props.name ? `Hi ${escapeHtml(props.name)},` : "Hi,";
  const url = escapeHtml(props.url);
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="background-color:#fafafa;color:#111;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;padding:32px 16px;">
  <div style="background-color:#ffffff;border:1px solid #eeeeee;border-radius:8px;margin:0 auto;max-width:480px;padding:32px;">
    <h1 style="font-size:20px;margin:0 0 16px;">Verify your email</h1>
    <p style="line-height:1.5;margin:0 0 16px;">${greeting}</p>
    <p style="line-height:1.5;margin:0 0 16px;">Tap the button below to verify your email address and finish setting up your omi account.</p>
    <p style="margin:0 0 24px;"><a href="${url}" style="background-color:#111111;border-radius:6px;color:#ffffff;display:inline-block;font-weight:600;padding:10px 18px;text-decoration:none;">Verify email</a></p>
    <p style="color:#555555;font-size:13px;line-height:1.5;margin:0 0 8px;">Or paste this link into your browser:</p>
    <p style="color:#555555;font-size:13px;margin:0 0 24px;word-break:break-all;">${url}</p>
    <p style="color:#888888;font-size:12px;margin:0;">If you didn't sign up for omi, you can safely ignore this email.</p>
  </div>
</body>
</html>`;
  return {
    subject,
    html,
    text: renderText(props),
  };
}

export default VerificationEmail;
