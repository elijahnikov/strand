import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Section,
} from "@react-email/components";
import type { ReactNode } from "react";

const bodyStyle = {
  backgroundColor: "#fafafa",
  color: "#111111",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  margin: 0,
  padding: "32px 16px",
};

const containerStyle = {
  backgroundColor: "#ffffff",
  border: "1px solid #eeeeee",
  borderRadius: "8px",
  margin: "0 auto",
  maxWidth: "480px",
  padding: "32px",
};

export function Layout({
  preview,
  children,
}: {
  preview: string;
  children: ReactNode;
}) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Section>{children}</Section>
        </Container>
      </Body>
    </Html>
  );
}
