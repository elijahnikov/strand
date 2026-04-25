import {
  Action,
  ActionPanel,
  Form,
  Icon,
  LaunchType,
  launchCommand,
  popToRoot,
  showToast,
  Toast,
} from "@raycast/api";
import { showFailureToast } from "@raycast/utils";
import { useState } from "react";
import { api } from "~/lib/api";
import { NotConnectedError } from "~/lib/auth";

interface FormValues {
  description: string;
  title: string;
  url: string;
}

const URL_RE = /^https?:\/\/.+/i;

export default function SaveUrl() {
  const [urlError, setUrlError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (values: FormValues) => {
    const url = values.url.trim();
    if (!URL_RE.test(url)) {
      setUrlError("Enter a valid http(s) URL");
      return;
    }
    setSubmitting(true);
    try {
      await api.captureWebsite({
        url,
        title: values.title.trim() || undefined,
        description: values.description.trim() || undefined,
      });
      await showToast({
        style: Toast.Style.Success,
        title: "Saved to Omi",
      });
      await popToRoot();
    } catch (err) {
      if (err instanceof NotConnectedError) {
        await launchCommand({
          name: "connect",
          type: LaunchType.UserInitiated,
        });
        return;
      }
      await showFailureToast(err, { title: "Could not save" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm
            icon={Icon.Bookmark}
            onSubmit={handleSubmit}
            title="Save to Omi"
          />
        </ActionPanel>
      }
      isLoading={submitting}
    >
      <Form.TextField
        autoFocus
        error={urlError}
        id="url"
        onChange={() => setUrlError(undefined)}
        placeholder="https://…"
        title="URL"
      />
      <Form.TextField
        id="title"
        placeholder="Optional — defaults to the page title"
        title="Title"
      />
      <Form.TextArea
        id="description"
        placeholder="Optional notes"
        title="Description"
      />
    </Form>
  );
}
