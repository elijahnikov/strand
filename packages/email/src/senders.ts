function getDomain(): string {
  const domain = process.env.EMAIL_DOMAIN;
  if (!domain) {
    throw new Error("EMAIL_DOMAIN is not set");
  }
  return domain;
}

function branded(localPart: string): string {
  return `omi <${localPart}@${getDomain()}>`;
}

export const senders = {
  get verification() {
    return branded("noreply");
  },
  get transactional() {
    return branded("noreply");
  },
  get updates() {
    return branded("updates");
  },
  get support() {
    return branded("support");
  },
  get supportReplyTo() {
    return `support@${getDomain()}`;
  },
};
