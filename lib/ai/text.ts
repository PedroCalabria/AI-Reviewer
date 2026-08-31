/**
 * Normalizing model output into the plain text a review reply has to be.
 *
 * A reply goes onto a public profile verbatim. It is not HTML, it is not
 * Markdown, and anything the model encodes for a browser is a defect the
 * customer would read literally.
 *
 * This came from a real draft: asked for a French reply, the model wrote
 * "Merci pour votre partage, Am&eacute;lie" — correct HTML, wrong medium. The
 * system instruction now asks for plain text, but that is a hint. This is the
 * enforcement, and it runs before validation so the guardrails see the same
 * characters a customer would.
 */

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  eacute: "é",
  egrave: "è",
  ecirc: "ê",
  euml: "ë",
  agrave: "à",
  acirc: "â",
  aacute: "á",
  atilde: "ã",
  auml: "ä",
  aring: "å",
  ccedil: "ç",
  iacute: "í",
  icirc: "î",
  iuml: "ï",
  igrave: "ì",
  oacute: "ó",
  ocirc: "ô",
  otilde: "õ",
  ouml: "ö",
  ograve: "ò",
  oslash: "ø",
  uacute: "ú",
  ucirc: "û",
  uuml: "ü",
  ugrave: "ù",
  ntilde: "ñ",
  yacute: "ý",
  szlig: "ß",
  aelig: "æ",
  euro: "€",
  pound: "£",
  deg: "°",
};

function decodeEntities(text: string): string {
  return text
    // &#233; and &#xE9;
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (whole, code: string) => {
      const point = code.toLowerCase().startsWith("x")
        ? Number.parseInt(code.slice(1), 16)
        : Number.parseInt(code, 10);
      if (!Number.isFinite(point) || point < 0x20 || point > 0x10ffff) {
        return whole;
      }
      try {
        return String.fromCodePoint(point);
      } catch {
        return whole;
      }
    })
    // &eacute; and friends. Case-insensitive on the name, and anything not in
    // the table is left exactly as written rather than guessed at.
    .replace(/&([a-z]+);/gi, (whole, name: string) => {
      const decoded = NAMED_ENTITIES[name.toLowerCase()];
      return decoded ?? whole;
    });
}

/**
 * Plain text, as a reply has to be.
 *
 * Entities are decoded twice because a double-encoded `&amp;eacute;` is a thing
 * models do; two passes settle it and a third would only start eating literal
 * ampersands the customer might legitimately see.
 */
export function toPlainReply(text: string): string {
  let out = decodeEntities(decodeEntities(text));

  // Markdown emphasis around a whole reply, which some models add unasked.
  out = out.replace(/^\s*[*_]{1,3}([\s\S]+?)[*_]{1,3}\s*$/, "$1");

  return out
    .replace(/\r\n?/g, "\n")
    // Collapse runs of blank lines; a review reply is a paragraph or two.
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}
