import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RenameFolderDialog } from "./RenameFolderDialog";

const mutateSpy = vi.fn();
const invalidateQueriesSpy = vi.fn();

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>(
    "@tanstack/react-query",
  );
  return {
    ...actual,
    useMutation: vi.fn(() => ({
      mutate: mutateSpy,
      isPending: false,
    })),
    useQueryClient: vi.fn(() => ({
      invalidateQueries: invalidateQueriesSpy,
    })),
  };
});

vi.mock("@convex-dev/react-query", () => ({
  useConvexMutation: vi.fn(() => vi.fn()),
}));

vi.mock("@hushletter/backend", () => ({
  api: {
    folders: {
      renameFolder: "folders.renameFolder",
    },
  },
}));

describe("RenameFolderDialog", () => {
  it("submits the renamed folder when value changes", async () => {
    const onOpenChange = vi.fn();

    render(
      <RenameFolderDialog
        open
        onOpenChange={onOpenChange}
        folderId="folder-1"
        currentName="Old Folder Name"
      />,
    );

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "New Folder Name" } });

    const saveButton = screen.getByRole("button", { name: /save|enregistrer/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mutateSpy).toHaveBeenCalledWith({
        folderId: "folder-1",
        newName: "New Folder Name",
      });
    });
  });
});
