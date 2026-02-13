import { describe, it, expect } from "vitest";

describe("NewslettersPage validateSearch", () => {
  const getValidateSearch = async () => {
    const { Route } = await import("./index");
    const validateSearch = Route.options.validateSearch;
    if (typeof validateSearch !== "function") {
      throw new Error("Expected validateSearch to be a function");
    }
    return validateSearch as (search: Record<string, unknown>) => Record<string, unknown>;
  };

  it("accepts valid folder and newsletter IDs", async () => {
    const validateSearch = await getValidateSearch();
    const result = validateSearch({
      folder: "k123folder",
      newsletter: "k123newsletter",
    });

    expect(result).toEqual({
      folder: "k123folder",
      newsletter: "k123newsletter",
      filter: undefined,
    });
  });

  it("accepts supported filters (hidden, starred)", async () => {
    const validateSearch = await getValidateSearch();

    expect(validateSearch({ filter: "hidden" })).toEqual({
      folder: undefined,
      filter: "hidden",
      newsletter: undefined,
    });

    expect(validateSearch({ filter: "starred" })).toEqual({
      folder: undefined,
      filter: "starred",
      newsletter: undefined,
    });
  });

  it("rejects unknown filters", async () => {
    const validateSearch = await getValidateSearch();
    const result = validateSearch({ filter: "random" });

    expect(result.filter).toBeUndefined();
  });

  it("rejects invalid ids (whitespace or empty)", async () => {
    const validateSearch = await getValidateSearch();
    const result = validateSearch({
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
  const getAutoSelection = async () => {
    const { getStarredAutoSelectionId } = await import("./index");
    return getStarredAutoSelectionId;
  };

  it("returns first newsletter when starred data is ready and none selected", async () => {
    const getStarredAutoSelectionId = await getAutoSelection();

    expect(
      getStarredAutoSelectionId({
        isDesktop: true,
        isFilteringByStarred: true,
        isPending: false,
        newsletters: [{ _id: "newest" }, { _id: "older" }],
      }),
    ).toBe("newest");
  });

  it("returns null while starred query is pending", async () => {
    const getStarredAutoSelectionId = await getAutoSelection();

    expect(
      getStarredAutoSelectionId({
        isDesktop: true,
        isFilteringByStarred: true,
        isPending: true,
        newsletters: [{ _id: "newest" }],
      }),
    ).toBeNull();
  });

  it("returns null when current selection still exists in starred list", async () => {
    const getStarredAutoSelectionId = await getAutoSelection();

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

  it("falls back to newest when current selection is not part of starred list", async () => {
    const getStarredAutoSelectionId = await getAutoSelection();

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
