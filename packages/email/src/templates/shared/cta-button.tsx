import { Button } from "@react-email/components";
import type { ReactNode } from "react";

const buttonStyle = {
  backgroundColor: "#111111",
  borderRadius: "6px",
  color: "#ffffff",
  display: "inline-block",
  fontWeight: 500,
  padding: "12px 20px",
  textDecoration: "none",
};

export function CTAButton({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Button href={href} style={buttonStyle}>
      {children}
    </Button>
  );
}
