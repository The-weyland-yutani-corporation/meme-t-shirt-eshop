/**
 * Thin wrapper around `jsonLdScriptProps` so pages can render structured
 * data with a single JSX element rather than repeating the
 * `dangerouslySetInnerHTML` boilerplate.
 */
import { jsonLdScriptProps } from "./structured-data.ts";

export function JsonLd({ data }: { data: unknown }) {
  return <script {...jsonLdScriptProps(data)} />;
}
