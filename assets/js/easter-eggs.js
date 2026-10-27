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
// Example:
//   ["sudo", () => "guest is not in the sudoers file. This incident will be reported."],
//   ["echo-twice", (args) => [args.join(" "), args.join(" ")]],
export const eggs = new Map([
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
