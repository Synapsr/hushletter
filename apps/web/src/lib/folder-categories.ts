import { m } from "@/paraglide/messages.js";

export const FOLDER_CATEGORIES = [
  "tech",
  "finance",
  "news",
  "health",
  "business",
  "design",
  "lifestyle",
  "sports",
  "science",
  "education",
  "entertainment",
  "other",
] as const;

export type FolderCategory = (typeof FOLDER_CATEGORIES)[number];

const CATEGORY_LABELS: Record<FolderCategory, () => string> = {
  tech: m.category_tech,
  finance: m.category_finance,
  news: m.category_news,
  health: m.category_health,
  business: m.category_business,
  design: m.category_design,
  lifestyle: m.category_lifestyle,
  sports: m.category_sports,
  science: m.category_science,
  education: m.category_education,
  entertainment: m.category_entertainment,
  other: m.category_other,
};

export function isPredefinedFolderCategory(
  category: string
): category is FolderCategory {
  return (FOLDER_CATEGORIES as readonly string[]).includes(category);
}

export function getCategoryLabel(category: string): string {
  const normalized = category.trim().toLowerCase();
  if (isPredefinedFolderCategory(normalized)) {
    return CATEGORY_LABELS[normalized]();
  }
  return category;
}
