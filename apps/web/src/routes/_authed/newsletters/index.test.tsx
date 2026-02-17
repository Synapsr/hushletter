import { describe, it, expect } from "vitest";
import {
  getPostEmptyBinSearch,
  getStarredAutoSelectionId,
  validateNewsletterSearch,
} from "./index";

describe("NewslettersPage validateSearch", () => {
  it("accepts valid folder and newsletter IDs", () => {
    const result = validateNewsletterSearch({
      folder: "k123folder",
      newsletter: "k123newsletter",
    });

    expect(result).toEqual({
      folder: "k123folder",
      newsletter: "k123newsletter",
      filter: undefined,
    });
  });

  it("accepts supported filters (hidden, starred, bin)", () => {
    expect(validateNewsletterSearch({ filter: "hidden" })).toEqual({
      folder: undefined,
      filter: "hidden",
      newsletter: undefined,
    });

    expect(validateNewsletterSearch({ filter: "starred" })).toEqual({
      folder: undefined,
      filter: "starred",
      newsletter: undefined,
    });

    expect(validateNewsletterSearch({ filter: "bin" })).toEqual({
      folder: undefined,
      filter: "bin",
      newsletter: undefined,
    });
  });

  it("rejects unknown filters", () => {
    const result = validateNewsletterSearch({ filter: "random" });

    expect(result.filter).toBeUndefined();
  });

  it("rejects invalid ids (whitespace or empty)", () => {
    const result = validateNewsletterSearch({
      folder: "   ",
      newsletter: "id with spaces",
    });

    expect(result).toEqual({
      folder: undefined,
      filter: undefined,
      newsletter: undefined,
    });
  });
});

describe("getStarredAutoSelectionId", () => {
  it("returns first newsletter when starred data is ready and none selected", () => {
    expect(
      getStarredAutoSelectionId({
        isDesktop: true,
        isFilteringByStarred: true,
        isPending: false,
        newsletters: [{ _id: "newest" }, { _id: "older" }],
      }),
    ).toBe("newest");
  });

  it("returns null while starred query is pending", () => {
    expect(
      getStarredAutoSelectionId({
        isDesktop: true,
        isFilteringByStarred: true,
        isPending: true,
        newsletters: [{ _id: "newest" }],
      }),
    ).toBeNull();
  });

  it("returns null when current selection still exists in starred list", () => {
    expect(
      getStarredAutoSelectionId({
        isDesktop: true,
        isFilteringByStarred: true,
        isPending: false,
        selectedNewsletterId: "existing",
        newsletters: [{ _id: "existing" }, { _id: "older" }],
      }),
    ).toBeNull();
  });

  it("falls back to newest when current selection is not part of starred list", () => {
    expect(
      getStarredAutoSelectionId({
        isDesktop: true,
        isFilteringByStarred: true,
        isPending: false,
        selectedNewsletterId: "missing",
        newsletters: [{ _id: "newest" }, { _id: "older" }],
      }),
    ).toBe("newest");
  });
});

describe("getPostEmptyBinSearch", () => {
  it("clears selected newsletter while staying in bin filter", () => {
    expect(
      getPostEmptyBinSearch({
        effectiveFilter: "bin",
        selectedNewsletterId: "k123newsletter",
      }),
    ).toEqual({ filter: "bin" });
  });

  it("does nothing outside bin filter", () => {
    expect(
      getPostEmptyBinSearch({
        effectiveFilter: "hidden",
        selectedNewsletterId: "k123newsletter",
      }),
    ).toBeNull();
  });
});
