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
