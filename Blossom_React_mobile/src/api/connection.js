// Dating, language exchange or both - what someone is on Blossom for.
// "both" is the default, and what older profiles have.
export const CONNECTION_TYPES = ["dating", "language", "both"];

export const CONNECTION_EMOJI = { dating: "💘", language: "🌍", both: "💘🌍" };

export function connectionOf(profile) {
  const value = profile?.connection_type;
  return CONNECTION_TYPES.includes(value) ? value : "both";
}

// With its emoji, e.g. "🌍 Language exchange".
export function connectionLabel(type, t) {
  return `${CONNECTION_EMOJI[type]} ${t(`connection.${type}`)}`;
}

// "🗣️ French, Arabic · 📚 English" for the cards of people open to language
// exchange. At most two of each, so it stays on one line.
export function languagesLine(profile) {
  const names = (list) =>
    (list || []).map((l) => l?.language_name || l).filter(Boolean).slice(0, 2);
  const speaks = names(profile?.languages);
  const learning = names(profile?.learning_languages);
  const parts = [];
  if (speaks.length) parts.push(`🗣️ ${speaks.join(", ")}`);
  if (learning.length) parts.push(`📚 ${learning.join(", ")}`);
  return parts.join("  ·  ");
}

// The sign-up questions that apply: someone here only for language exchange
// skips the dating ones (marked "for" in questions.json).
export function questionsFor(questions, connectionType) {
  const type = CONNECTION_TYPES.includes(connectionType) ? connectionType : "both";
  return questions.filter((q) => !q.for || q.for.includes(type));
}
