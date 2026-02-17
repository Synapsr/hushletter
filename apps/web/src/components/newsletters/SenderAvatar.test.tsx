import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SenderAvatar, SenderAvatarGroup } from "./SenderAvatar";

describe("SenderAvatar", () => {
  it("renders initials fallback", () => {
    render(
      <SenderAvatar senderName="Tech Weekly" senderEmail="news@example.com" />,
    );

    expect(screen.getByText("T")).toBeInTheDocument();
  });

  it("renders explicit sender image when provided", () => {
    render(
      <SenderAvatar
        senderName="Tech Weekly"
        senderEmail="news@example.com"
        senderImageUrl="https://cdn.example.com/avatar.png"
      />,
    );

    expect(screen.getByRole("img", { name: "Tech Weekly" })).toHaveAttribute(
      "src",
      "https://cdn.example.com/avatar.png",
    );
  });

  it("uses email-based avatar lookup, then domain logo, then initials", () => {
    render(<SenderAvatar senderName="Sender" senderEmail="sender@example.com" />);

    const image = screen.getByRole("img", { name: "Sender" });
    expect(image).toHaveAttribute(
      "src",
      "https://unavatar.io/sender%40example.com?fallback=false",
    );

    fireEvent.error(image);
    expect(image).toHaveAttribute("src", "https://logo.clearbit.com/example.com");

    fireEvent.error(image);
    expect(screen.queryByRole("img", { name: "Sender" })).not.toBeInTheDocument();
    expect(screen.getByText("S")).toBeInTheDocument();
  });

  it("does not render image when email has no domain", () => {
    render(<SenderAvatar senderName="No Image" senderEmail="No Image" />);

    expect(screen.queryByRole("img", { name: "No Image" })).not.toBeInTheDocument();
  });

  it("renders a sender avatar group with up to 3 senders", () => {
    render(
      <SenderAvatarGroup
        senders={[
          { senderName: "Alpha", senderEmail: "alpha@example.com" },
          { senderName: "Beta", senderEmail: "beta@example.com" },
          { senderName: "Gamma", senderEmail: "gamma@example.com" },
          { senderName: "Delta", senderEmail: "delta@example.com" },
        ]}
      />,
    );

    expect(screen.getByRole("img", { name: "Alpha" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Beta" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Gamma" })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Delta" })).not.toBeInTheDocument();
  });
});
