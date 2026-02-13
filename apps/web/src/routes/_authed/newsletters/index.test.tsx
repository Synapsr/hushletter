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
