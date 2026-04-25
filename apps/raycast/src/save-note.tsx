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
  body: string;
  title: string;
}

const LINE_SPLIT_RE = /\r?\n+/;

function buildNoteDoc(body: string) {
  const paragraphs = body
    .split(LINE_SPLIT_RE)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => ({
      type: "paragraph",
      content: [{ type: "text", text: line }],
    }));
  return {
    type: "doc",
    content: paragraphs.length > 0 ? paragraphs : [{ type: "paragraph" }],
  };
}

export default function SaveNote() {
  const [titleError, setTitleError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (values: FormValues) => {
    const title = values.title.trim();
    if (!title) {
      setTitleError("Title is required");
      return;
    }
    setSubmitting(true);
    const toast = await showToast({
      style: Toast.Style.Animated,
      title: "Saving note…",
    });
    try {
      const body = values.body.trim();
      await api.captureNote({
        title,
        plainTextContent: body || undefined,
        jsonContent: body ? JSON.stringify(buildNoteDoc(body)) : undefined,
      });
      toast.style = Toast.Style.Success;
      toast.title = "Note saved";
      await popToRoot();
    } catch (err) {
      toast.hide();
      if (err instanceof NotConnectedError) {
        await launchCommand({
          name: "connect",
          type: LaunchType.UserInitiated,
        });
        return;
      }
      await showFailureToast(err, { title: "Could not save note" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm
            icon={Icon.Document}
            onSubmit={handleSubmit}
            title="Save Note"
          />
        </ActionPanel>
      }
      isLoading={submitting}
    >
      <Form.TextField
        autoFocus
        error={titleError}
        id="title"
        onChange={() => setTitleError(undefined)}
        placeholder="Note title"
        title="Title"
      />
      <Form.TextArea
        enableMarkdown={false}
        id="body"
        placeholder="Body — plain text, line breaks become paragraphs"
        title="Body"
      />
    </Form>
  );
}
