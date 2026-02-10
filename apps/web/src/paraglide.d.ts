// Type declarations for Paraglide JS generated modules
// These files are generated at build/dev time and have no .d.ts output

declare module "@/paraglide/messages.js" {
  type MessageFunction = (...args: any[]) => string;
  export const m: Record<string, MessageFunction>;
  const messages: Record<string, MessageFunction>;
  export = messages;
}

declare module "@/paraglide/runtime.js" {
  export type Locale = string;
  export function getLocale(): Locale;
  export function setLocale(locale: Locale): void;
  export const locales: readonly Locale[];
  export const baseLocale: Locale;
  export function localizeUrl(url: URL): URL;
  export function deLocalizeUrl(url: URL): URL;
  export let serverAsyncLocalStorage: any;
  export function overwriteServerAsyncLocalStorage(value: any): void;
}

declare module "@/paraglide/server.js" {
  export function paraglideMiddleware(
    request: Request,
    resolve: (args: { request: Request; locale: string }) => Response | Promise<Response>,
    callbacks?: { onRedirect?: (response: Response) => void }
  ): Response | Promise<Response>;
}

// Also handle relative imports from router.tsx and server.ts
declare module "./paraglide/messages.js" {
  type MessageFunction = (...args: any[]) => string;
  export const m: Record<string, MessageFunction>;
  const messages: Record<string, MessageFunction>;
  export = messages;
}

declare module "./paraglide/runtime.js" {
  export type Locale = string;
  export function getLocale(): Locale;
  export function setLocale(locale: Locale): void;
  export const locales: readonly Locale[];
  export const baseLocale: Locale;
  export function localizeUrl(url: URL): URL;
  export function deLocalizeUrl(url: URL): URL;
}

declare module "./paraglide/server.js" {
  export function paraglideMiddleware(
    request: Request,
    resolve: (args: { request: Request; locale: string }) => Response | Promise<Response>,
    callbacks?: { onRedirect?: (response: Response) => void }
  ): Response | Promise<Response>;
}
