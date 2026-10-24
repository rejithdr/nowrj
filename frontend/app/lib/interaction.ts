/** Shown above the question box unless the programme sets its own notice. */
export const DEFAULT_QUESTION_NOTICE =
  "General information only, not medical advice. In an emergency, contact a doctor or call 112.";

export type InteractionType = "song" | "question";

/** Words that change between song-request and question programmes. */
export const wording = {
  song: { button: "Request a song", queue: "Song requests", item: "request", items: "requests", done: "Played", doneLong: "Played" },
  question: { button: "Ask a question", queue: "Questions", item: "question", items: "questions", done: "Answered", doneLong: "Answered on air" },
} as const;

/** Same rule as the server: no phone numbers, email addresses or links. */
export function hasContactDetails(text: string): boolean {
  return (
    /(?:\+?\d[\s().-]*){7,}/.test(text) ||
    /[^\s@]+@[^\s@]+\.[a-z]{2,}/i.test(text) ||
    /(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:com|in|net|org|io|me|co|info|xyz|ly|app|link|site|online|biz)\b/i.test(text)
  );
}
