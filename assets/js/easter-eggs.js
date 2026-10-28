// Easter eggs for the interactive terminal.
//
// Both maps start empty on purpose: fill them in. Eggs are left out of `help`
// and tab completion so visitors have to discover them on their own.

// eggs: command name -> handler(args, term)
//   - args: the words after the command name (quotes are respected).
//   - Return a string (may contain "\n") or an array of strings to print it,
//     or call term.print(text) / term.error(text) / term.clear() yourself.
//   - An egg with the same name as a built-in command overrides it.
//   - Output is always rendered as plain text (textContent), so echoing
//     visitor input back is XSS-safe. Never switch it to innerHTML.
//
export const eggs = new Map([
  // xkcd #149
  ["sudo", (args) => args.join(" ") === "make me a sandwich"
    ? "Okay."
    : "guest is not in the sudoers file. This incident will be reported."],
  ["make", (args) => args.join(" ") === "me a sandwich"
    ? "What? Make it yourself."
    : "make: *** No targets specified and no makefile found.  Stop."],

  ["rm", (args) => args.includes("/") && args.some((a) => /^-\w*r/.test(a))
    ? ["rm: it is dangerous to operate recursively on '/'",
       "rm: use --no-preserve-root to override this failsafe",
       "(nice try)"]
    : "rm: cannot remove: Read-only file system"],

  ["vim", () => ["We don't have vim."]],
  ["emacs", () => "emacs: command not found. Have you tried vim?"],
  ["apt", () => "E: Could not open lock file /var/lib/dpkg/lock - open (13: Permission denied). Are you root?"],
  ["curl", (args) => args[0] === "coffee" ? "HTTP/1.1 418 I'm a teapot" : "curl: (6) Could not resolve host"],
]);

// files: extra entries for the virtual filesystem.
//   - Key: an absolute path ("/etc/motd") or a home-relative one ("~/.flag").
//     Missing parent directories are created automatically.
//   - Names starting with "." are hidden from `ls` and `tree` unless -a is used.
//   - Value: a string (may contain "\n") or an array of lines.
//   - Everything here ships to the browser: anyone can read it in the page
//     source, so never put a real secret in it.
//
// Example:
//   ["~/.flag", "ZmxhZ3t5b3VfZm91bmRfaXR9"],
//   ["/etc/motd", ["Authorized users only.", "All activity may be monitored."]],
export const files = new Map([
]);

// patterns: regexes tested against the raw input line before any command runs.
//   - run(input, term) works like an egg handler: return text or call term.print().
//   - Never use the /g flag: it makes .test() keep state between calls.
//   - Never pass the input to eval/innerHTML or echo it back; respond with fixed text.
//   - Keep regexes simple (no nested repeats) so a crafted line can't hang the tab.
export const patterns = [
  {
    // Common XSS probes: <script>, onerror= / onload=, javascript:, alert(...)
    test: /<\s*\/?\s*script|\bon(?:error|load)\s*=|javascript\s*:|\b(?:alert|prompt|confirm)\s*\(/i,
    run: (input, term) => {
      term.print("XSS attempt detected. Payload forwarded to /dev/null.", "t-err");
      // Fixed string: the visitor's payload itself never runs. The short delay
      // lets the line above render before the dialog blocks the page.
      setTimeout(() => alert("nice try 😏"), 50);
    },
  },
  {
    // SQL injection classics: ' OR 1=1, UNION SELECT, '; DROP TABLE
    test: /'\s*or\s+'?1'?\s*=\s*'?1|\bunion\s+(?:all\s+)?select\b|;\s*drop\s+table\b/i,
    run: () => "SQL injection? There isn't even a database here.",
  },
  {
    // Template injection probes: {{7*7}} and ${7*7}
    test: /\{\{\s*7\s*\*\s*7\s*\}\}|\$\{\s*7\s*\*\s*7\s*\}/,
    run: () => "49. Template injection would be cool, but this is a static site.",
  },
];
