import { Heading, Text } from "@react-email/components";
import { render } from "@react-email/render";
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

export async function renderVerificationEmail(
  props: VerificationEmailProps
): Promise<{ subject: string; html: string; text: string }> {
  const html = await render(<VerificationEmail {...props} />);
  return {
    subject,
    html,
    text: renderText(props),
  };
}

export default VerificationEmail;
