import { Text } from "@react-email/components";

const footerStyle = {
  color: "#888888",
  fontSize: "12px",
  lineHeight: "1.5",
  margin: "24px 0 0",
};

export function Footer({ children }: { children: string }) {
  return <Text style={footerStyle}>{children}</Text>;
}
