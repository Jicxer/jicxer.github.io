// Interactive terminal for the hero section.
//
// Content is read from the page's own sections (single source of truth), mounted
// into a small in-memory filesystem, and explored with Linux-style commands.
//
// Security rules for this file:
//   - All output is rendered with textContent / createElement, never innerHTML.
//   - Commands and filesystem entries live in Maps, so names like "__proto__"
//     or "constructor" can't resolve to Object.prototype members.
//   - Input length and scrollback are capped so a visitor can't freeze their own tab.
import { eggs, files as extraFiles } from "./easter-eggs.js";

const MAX_INPUT = 256;
const MAX_LINES = 1000;
const HOME = ["home", "guest"];

const $ = (id) => document.getElementById(id);
const terminal = $("terminal");
const body = $("term-body");
const output = $("term-output");
const inputLine = $("term-input-line");
const input = $("term-input");
const promptLabel = $("term-prompt");
const title = $("term-title");
const chips = $("term-chips");

const USER = terminal.dataset.user || "guest";
const HOST = terminal.dataset.host || "localhost";
const loadedAt = new Date();

const clean = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// ==========================================================================
// Virtual filesystem
// ==========================================================================
const dir = () => ({ type: "dir", children: new Map() });
const file = (lines) => ({ type: "file", lines });
const root = dir();

let cwd = [...HOME];
let prevCwd = [...HOME];

// Resolve a path string to an array of segments. ".." is clamped at "/",
// so no path can climb above the root.
function resolve(path) {
  let parts;
  let rest = path || "~";
  if (rest === "~" || rest.startsWith("~/")) {
    parts = [...HOME];
    rest = rest.slice(1);
  } else if (rest.startsWith("/")) {
    parts = [];
  } else {
    parts = [...cwd];
  }
  for (const seg of rest.split("/")) {
    if (!seg || seg === ".") continue;
    if (seg === "..") parts.pop();
    else parts.push(seg);
  }
  return parts;
}

function lookup(parts) {
  let node = root;
  for (const seg of parts) {
    if (node.type !== "dir") return null;
    node = node.children.get(seg);
    if (!node) return null;
  }
  return node;
}

function mkdirp(parts) {
  let node = root;
  for (const seg of parts) {
    let next = node.children.get(seg);
    if (!next) {
      next = dir();
      node.children.set(seg, next);
    }
    node = next;
  }
  return node;
}

function writeFile(path, lines) {
  const parts = resolve(path);
  const name = parts.pop();
  if (!name) return;
  mkdirp(parts).children.set(name, file(lines));
}

function displayPath(parts) {
  const inHome = HOME.every((seg, i) => parts[i] === seg);
  if (inHome) return "~" + (parts.length > HOME.length ? "/" + parts.slice(HOME.length).join("/") : "");
  return "/" + parts.join("/");
}

// --------------------------------------------------------------------------
// Build files from the page content. Each line is a string or a segment
// ({ text, cls, href }) / array of segments.
// --------------------------------------------------------------------------
const H = (text) => ({ text, cls: "t-head" });
const M = (text) => ({ text, cls: "t-muted" });

function safeHttpsUrl(href) {
  try {
    const url = new URL(href, location.href);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function buildFilesystem() {
  mkdirp(HOME);
  mkdirp(["etc"]);
  mkdirp(["tmp"]);

  writeFile("~/about.txt", [
    H(clean(document.querySelector(".hero-name"))),
    M(clean(document.querySelector(".hero-role"))),
    "",
    clean(document.querySelector("#about .lead")),
  ]);

  mkdirp([...HOME, "experience"]);
  document.querySelectorAll("#experience .timeline-item").forEach((item) => {
    const role = clean(item.querySelector("h3"));
    const lines = [
      H(role),
      [{ text: clean(item.querySelector(".org")), cls: "t-org" }, M("  " + clean(item.querySelector("time")))],
      "",
      ...[...item.querySelectorAll(".bullets li")].map((li) => "- " + clean(li)),
    ];
    writeFile("~/experience/" + (item.dataset.file || slug(role) + ".txt"), lines);
  });

  mkdirp([...HOME, "projects"]);
  document.querySelectorAll("#projects .card").forEach((card) => {
    const heading = card.querySelector("h3").cloneNode(true);
    const sub = heading.querySelector(".card-sub");
    if (sub) sub.remove();
    const name = clean(heading);
    const lines = [H("# " + name)];
    if (sub) lines.push(M(clean(sub)));
    const tags = [...card.querySelectorAll(".tags li")].map(clean);
    if (tags.length) lines.push({ text: tags.join(" · "), cls: "t-org" });
    lines.push("", ...[...card.querySelectorAll(".bullets li")].map((li) => "- " + clean(li)));
    writeFile("~/projects/" + (card.dataset.file || slug(name) + ".md"), lines);
  });

  const skills = [];
  document.querySelectorAll("#skills .skill-group").forEach((group) => {
    skills.push(H(clean(group.querySelector("h3")) + ":"));
    skills.push("  " + [...group.querySelectorAll(".tags li")].map(clean).join(", "));
  });
  writeFile("~/skills.txt", skills);

  const edu = [];
  document.querySelectorAll("#skills .edu > div").forEach((entry, i) => {
    if (i) edu.push("");
    edu.push(H(clean(entry.querySelector(".edu-title"))));
    const meta = entry.querySelector(".meta");
    if (meta) edu.push([{ text: clean(meta.querySelector(".org")), cls: "t-org" }, M("  " + clean(meta.querySelector("time")))]);
    const notes = entry.querySelector(".muted");
    if (notes) edu.push(M(clean(notes)));
  });
  writeFile("~/education.txt", edu);

  const contact = [];
  const emailBtn = $("copy-email");
  if (emailBtn) contact.push([M("email     "), { text: emailBtn.dataset.user + "@" + emailBtn.dataset.domain }]);
  document.querySelectorAll("#contact .contact-row a").forEach((a) => {
    const href = safeHttpsUrl(a.getAttribute("href"));
    if (href) contact.push([M(clean(a).toLowerCase().padEnd(10)), { text: href, href }]);
  });
  contact.push("", M("Tip: the 'Copy email' button in the contact section copies the address."));
  writeFile("~/contact.txt", contact);

  for (const [path, value] of extraFiles) {
    writeFile(path, Array.isArray(value) ? value.map(String) : String(value).split("\n"));
  }
}

// ==========================================================================
// Output
// ==========================================================================
function appendSegments(parent, segs) {
  for (const seg of segs) {
    if (typeof seg === "string") {
      parent.appendChild(document.createTextNode(seg));
      continue;
    }
    const el = document.createElement(seg.href ? "a" : "span");
    el.textContent = seg.text;
    if (seg.cls) el.className = seg.cls;
    if (seg.href) {
      el.href = seg.href;
      el.target = "_blank";
      el.rel = "noopener noreferrer";
    }
    parent.appendChild(el);
  }
}

function printLine(line, cls) {
  const row = document.createElement("div");
  row.className = "term-line" + (cls ? " " + cls : "");
  appendSegments(row, Array.isArray(line) ? line : [line]);
  output.appendChild(row);
  while (output.childElementCount > MAX_LINES) output.firstElementChild.remove();
}

// print("text\nmore") or print(["line", "line"]) prints lines; a styled line is a
// segment ({ text, cls, href }) or an array of segments: use printLine() for those.
function print(content, cls) {
  if (content == null) return;
  let lines;
  if (Array.isArray(content)) lines = content;
  else if (typeof content === "object") lines = [content];
  else lines = String(content).split("\n");
  for (const line of lines) printLine(line, cls);
}

const error = (text) => print(text, "t-err");

function clear() {
  output.replaceChildren();
}

function promptSegments() {
  return [
    { text: `${USER}@${HOST}`, cls: "t-userhost" },
    ":",
    { text: displayPath(cwd), cls: "t-path" },
    "$",
  ];
}

function renderPrompt() {
  promptLabel.replaceChildren();
  appendSegments(promptLabel, promptSegments());
  title.textContent = `${USER}@${HOST}: ${displayPath(cwd)}`;
}

function scrollToBottom() {
  body.scrollTop = body.scrollHeight;
}

// ==========================================================================
// Commands
// ==========================================================================
// Split on whitespace, honoring single and double quotes.
function tokenize(line) {
  const tokens = [];
  let cur = "";
  let quote = null;
  let started = false;
  for (const ch of line) {
    if (quote) {
      if (ch === quote) quote = null;
      else cur += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      started = true;
    } else if (/\s/.test(ch)) {
      if (started) tokens.push(cur);
      cur = "";
      started = false;
    } else {
      cur += ch;
      started = true;
    }
  }
  if (started) tokens.push(cur);
  return tokens;
}

// Separate "-la" style flags from operands.
function parseFlags(args) {
  const flags = new Set();
  const operands = [];
  for (const arg of args) {
    if (arg.length > 1 && arg.startsWith("-")) [...arg.slice(1)].forEach((f) => flags.add(f));
    else operands.push(arg);
  }
  return { flags, operands };
}

const visibleEntries = (node, all) =>
  [...node.children.entries()]
    .filter(([name]) => all || !name.startsWith("."))
    .sort(([a], [b]) => a.localeCompare(b));

const entrySeg = (name, node) => {
  if (node.type !== "dir") return { text: name };
  return { text: name === "." || name === ".." ? name : name + "/", cls: "t-dir" };
};

const fileSize = (node) =>
  node.type === "dir" ? 4096 : node.lines.reduce((n, line) => n + lineText(line).length + 1, 0);

function lineText(line) {
  if (typeof line === "string") return line;
  if (Array.isArray(line)) return line.map(lineText).join("");
  return line.text;
}

function stamp(d) {
  const mon = d.toLocaleString("en-US", { month: "short" });
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${mon} ${String(d.getDate()).padStart(2, " ")} ${hh}:${mm}`;
}

function longEntry(name, node) {
  const perms = node.type === "dir" ? "drwxr-xr-x" : "-rw-r--r--";
  const meta = `${perms} 1 ${USER} ${USER} ${String(fileSize(node)).padStart(5)} ${stamp(loadedAt)} `;
  return [M(meta), entrySeg(name, node)];
}

function catPath(path, cmd = "cat") {
  const node = lookup(resolve(path));
  if (!node) return error(`${cmd}: ${path}: No such file or directory`);
  if (node.type === "dir") return error(`${cmd}: ${path}: Is a directory`);
  print(node.lines);
}

function catDir(path) {
  const node = lookup(resolve(path));
  if (!node || node.type !== "dir") return error(`cat: ${path}: No such file or directory`);
  visibleEntries(node, false).forEach(([name, child], i) => {
    if (child.type !== "file") return;
    if (i) print("");
    print(M(`==> ${path}/${name} <==`));
    print(child.lines);
  });
}

function treeLines(node, prefix, all, counts) {
  const entries = visibleEntries(node, all);
  entries.forEach(([name, child], i) => {
    const last = i === entries.length - 1;
    printLine([M(prefix + (last ? "└── " : "├── ")), entrySeg(name, child)]);
    if (child.type === "dir") {
      counts.dirs++;
      treeLines(child, prefix + (last ? "    " : "│   "), all, counts);
    } else {
      counts.files++;
    }
  });
}

function formatDate(d) {
  const tz = new Intl.DateTimeFormat("en-US", { timeZoneName: "short" })
    .formatToParts(d)
    .find((p) => p.type === "timeZoneName");
  const day = d.toLocaleString("en-US", { weekday: "short" });
  const time = d.toTimeString().slice(0, 8);
  return `${day} ${stamp(d).slice(0, 6)} ${time} ${tz ? tz.value : ""} ${d.getFullYear()}`.replace(/\s+/g, " ");
}

function uptime() {
  const mins = Math.floor(performance.now() / 60000);
  return mins < 1 ? "less than a minute" : `${mins} min${mins === 1 ? "" : "s"}`;
}

function goToGui(message) {
  print(M(message));
  const about = $("about");
  if (about) about.scrollIntoView();
}

const commandHistory = [];

// name -> { group, usage, desc, run(args) }
const commands = new Map();
const def = (name, group, usage, desc, run) => commands.set(name, { group, usage, desc, run });

// ---- Portfolio shortcuts -------------------------------------------------
def("about", "Portfolio", "about", "Who I am", () => catPath("~/about.txt"));
def("experience", "Portfolio", "experience", "Work history", () => catDir("~/experience"));
def("projects", "Portfolio", "projects", "Things I've built", () => catDir("~/projects"));
def("skills", "Portfolio", "skills", "Languages, tools and platforms", () => catPath("~/skills.txt"));
def("education", "Portfolio", "education", "Degree and certifications", () => catPath("~/education.txt"));
def("contact", "Portfolio", "contact", "How to reach me", () => catPath("~/contact.txt"));
def("gui", "Portfolio", "gui", "Scroll down to the regular page", () => goToGui("Switching to GUI mode..."));

// ---- Filesystem ----------------------------------------------------------
def("ls", "Filesystem", "ls [-a] [-l] [path...]", "List directory contents", (args) => {
  const { flags, operands } = parseFlags(args);
  const all = flags.has("a");
  const long = flags.has("l");
  const targets = operands.length ? operands : ["."];
  targets.forEach((path, i) => {
    const node = lookup(resolve(path));
    if (!node) return error(`ls: cannot access '${path}': No such file or directory`);
    if (targets.length > 1) {
      if (i) print("");
      print(path + ":");
    }
    if (node.type === "file") {
      print(long ? [longEntry(path, node)] : path);
      return;
    }
    const entries = visibleEntries(node, all);
    if (all) entries.unshift([".", node], ["..", lookup(resolve(path + "/..")) || node]);
    if (long) {
      print(M(`total ${entries.length * 4}`));
      entries.forEach(([name, child]) => print([longEntry(name, child)]));
    } else if (entries.length) {
      const segs = [];
      entries.forEach(([name, child], j) => {
        if (j) segs.push("  ");
        segs.push(entrySeg(name, child));
      });
      print([segs]);
    }
  });
});

def("cd", "Filesystem", "cd [path | -]", "Change directory", (args) => {
  const path = args[0] === "-" ? displayPath(prevCwd) : args[0];
  const parts = resolve(path);
  const node = lookup(parts);
  if (!node) return error(`bash: cd: ${path}: No such file or directory`);
  if (node.type !== "dir") return error(`bash: cd: ${path}: Not a directory`);
  prevCwd = cwd;
  cwd = parts;
  if (args[0] === "-") print(displayPath(cwd));
});

def("pwd", "Filesystem", "pwd", "Print working directory", () => print("/" + cwd.join("/")));

def("cat", "Filesystem", "cat <file...>", "Print file contents", (args) => {
  if (!args.length) return error("cat: missing file operand");
  args.forEach((path) => catPath(path));
});

def("tree", "Filesystem", "tree [-a] [path]", "Show directory tree", (args) => {
  const { flags, operands } = parseFlags(args);
  const path = operands[0] || ".";
  const node = lookup(resolve(path));
  if (!node || node.type !== "dir") return error(`${path} [error opening dir]`);
  print({ text: path, cls: "t-dir" });
  const counts = { dirs: 0, files: 0 };
  treeLines(node, "", flags.has("a"), counts);
  print("");
  print(`${counts.dirs} director${counts.dirs === 1 ? "y" : "ies"}, ${counts.files} file${counts.files === 1 ? "" : "s"}`);
});

// ---- System --------------------------------------------------------------
def("help", "System", "help", "List available commands", () => {
  const groups = new Map();
  for (const [, cmd] of commands) {
    if (!groups.has(cmd.group)) groups.set(cmd.group, []);
    groups.get(cmd.group).push(cmd);
  }
  for (const [group, cmds] of groups) {
    print(H(group));
    cmds.forEach((cmd) => printLine([{ text: "  " + cmd.usage.padEnd(24), cls: "t-cmdname" }, M(cmd.desc)]));
  }
  print("");
  print(M("Tab completes · ↑/↓ history · Ctrl+L clear · Ctrl+C cancel · Ctrl+U clear line"));
});

def("man", "System", "man <command>", "Show a command's manual", (args) => {
  if (!args.length) return error("What manual page do you want?\nFor example, try 'man ls'.");
  const cmd = commands.get(args[0]);
  if (!cmd) return error(`No manual entry for ${args[0]}`);
  print([H("NAME"), `    ${args[0]} - ${cmd.desc}`, "", H("SYNOPSIS"), `    ${cmd.usage}`]);
});

def("clear", "System", "clear", "Clear the screen", clear);

def("history", "System", "history", "Show command history", () => {
  commandHistory.forEach((cmd, i) => print(`${String(i + 1).padStart(5)}  ${cmd}`));
});

def("echo", "System", "echo [text...]", "Print text", (args) => print(args.join(" ")));

def("whoami", "System", "whoami", "Print current user", () => print(USER));

def("date", "System", "date", "Print the date and time", () => print(formatDate(new Date())));

def("uname", "System", "uname [-a]", "Print system information", (args) => {
  const { flags } = parseFlags(args);
  print(flags.has("a") ? `Linux ${HOST} 6.1.0-portfolio #1 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux` : "Linux");
});

def("neofetch", "System", "neofetch", "Show system info", () => {
  const art = [
    "    .--.     ",
    "   |o_o |    ",
    "   |:_/ |    ",
    "  //   \\ \\   ",
    " (|     | )  ",
    "/'\\_   _/`\\  ",
    "\\___)=(___/  ",
  ];
  const certs = [...document.querySelectorAll("#about .badge")].map(clean).join(", ");
  const info = [
    [{ text: `${USER}@${HOST}`, cls: "t-userhost" }],
    [M("-".repeat(USER.length + HOST.length + 1))],
    [{ text: "OS: ", cls: "t-head" }, "Portfolio Linux x86_64"],
    [{ text: "Host: ", cls: "t-head" }, "GitHub Pages"],
    [{ text: "Role: ", cls: "t-head" }, clean(document.querySelector(".hero-role"))],
    [{ text: "Creds: ", cls: "t-head" }, certs],
    [{ text: "Uptime: ", cls: "t-head" }, uptime()],
  ];
  art.forEach((a, i) => print([[{ text: a, cls: "t-art" }, ...(info[i] || [])]]));
});

def("exit", "System", "exit", "Leave the terminal", () => goToGui("logout"));

// ==========================================================================
// Execution
// ==========================================================================
function echoCommand(raw) {
  print([[...promptSegments(), " " + raw]], "t-echo");
}

function toLines(result) {
  if (result == null) return;
  print(Array.isArray(result) ? result.map(String) : String(result));
}

function run(rawInput) {
  let raw = rawInput.slice(0, MAX_INPUT);
  echoCommand(raw);

  if (raw.includes("!!")) {
    const last = commandHistory[commandHistory.length - 1];
    if (!last) return error("bash: !!: event not found");
    raw = raw.split("!!").join(last);
    print(raw);
  }

  const trimmed = raw.trim();
  if (!trimmed) return;
  if (commandHistory[commandHistory.length - 1] !== trimmed) commandHistory.push(trimmed);

  const [name, ...args] = tokenize(trimmed);
  if (name === undefined) return;
  const term = { print, error, clear };

  try {
    // Easter eggs win over built-ins so they can override them.
    const egg = eggs.get(name);
    if (egg) return toLines(egg(args, term));

    // Accept "/help" as well as "help".
    const cmd = commands.get(name) || (name.startsWith("/") ? commands.get(name.slice(1)) : undefined);
    if (cmd) return cmd.run(args);

    if (name.includes("/")) {
      const node = lookup(resolve(name));
      if (!node) return error(`bash: ${name}: No such file or directory`);
      return error(`bash: ${name}: ${node.type === "dir" ? "Is a directory" : "Permission denied"}`);
    }
    error(`bash: ${name}: command not found`);
  } catch (err) {
    console.error(err);
    error(`bash: ${name}: internal error`);
  }
}

function submit(raw) {
  run(raw);
  renderPrompt();
  scrollToBottom();
}

// ==========================================================================
// Tab completion
// ==========================================================================
function commonPrefix(words) {
  let prefix = words[0];
  for (const w of words) while (!w.startsWith(prefix)) prefix = prefix.slice(0, -1);
  return prefix;
}

function complete() {
  const value = input.value;
  if (input.selectionStart !== value.length) return;

  const lastSpace = value.lastIndexOf(" ");
  const partial = value.slice(lastSpace + 1);
  const before = value.slice(0, lastSpace + 1);
  let candidates;
  let stem;

  if (lastSpace === -1) {
    // Completing a command name. Eggs are intentionally not offered.
    stem = "";
    candidates = [...commands.keys()].filter((c) => c.startsWith(partial)).map((c) => ({ name: c, dir: false }));
  } else {
    const slash = partial.lastIndexOf("/");
    stem = partial.slice(0, slash + 1);
    const base = partial.slice(slash + 1);
    const node = lookup(resolve(stem || "."));
    if (!node || node.type !== "dir") return;
    candidates = visibleEntries(node, base.startsWith("."))
      .filter(([name]) => name.startsWith(base))
      .map(([name, child]) => ({ name, dir: child.type === "dir" }));
  }

  if (!candidates.length) return;
  if (candidates.length === 1) {
    const [only] = candidates;
    input.value = before + stem + only.name + (only.dir ? "/" : " ");
    return;
  }
  const prefix = commonPrefix(candidates.map((c) => c.name));
  const current = partial.slice(stem.length);
  if (prefix.length > current.length) {
    input.value = before + stem + prefix;
    return;
  }
  // Nothing more to complete: list the options like bash does.
  echoCommand(value);
  const segs = [];
  candidates.forEach((c, i) => {
    if (i) segs.push("  ");
    segs.push(c.dir ? { text: c.name + "/", cls: "t-dir" } : { text: c.name });
  });
  print([segs]);
  scrollToBottom();
}

// ==========================================================================
// Wiring
// ==========================================================================
let historyIndex = 0;
let draft = "";

function onKeyDown(e) {
  const key = e.key;

  if (key === "Enter") {
    e.preventDefault();
    const raw = input.value;
    input.value = "";
    submit(raw);
    historyIndex = commandHistory.length;
    draft = "";
    return;
  }

  if (key === "Tab") {
    e.preventDefault();
    complete();
    return;
  }

  if (key === "ArrowUp" || key === "ArrowDown") {
    e.preventDefault();
    if (historyIndex === commandHistory.length) draft = input.value;
    historyIndex += key === "ArrowUp" ? -1 : 1;
    historyIndex = Math.max(0, Math.min(commandHistory.length, historyIndex));
    input.value = historyIndex === commandHistory.length ? draft : commandHistory[historyIndex];
    return;
  }

  if (!e.ctrlKey || e.metaKey || e.altKey) return;
  const k = key.toLowerCase();

  if (k === "l") {
    e.preventDefault();
    clear();
  } else if (k === "u") {
    e.preventDefault();
    input.value = input.value.slice(input.selectionEnd);
    input.setSelectionRange(0, 0);
  } else if (k === "c") {
    // Leave Ctrl+C alone when the visitor is copying selected text.
    const hasSelection = input.selectionStart !== input.selectionEnd || String(window.getSelection()).length > 0;
    if (hasSelection) return;
    e.preventDefault();
    echoCommand(input.value + "^C");
    input.value = "";
    historyIndex = commandHistory.length;
    scrollToBottom();
  }
}

function init() {
  buildFilesystem();

  const staticCursor = $("term-static-cursor");
  if (staticCursor) staticCursor.remove();
  print(M("Welcome! Type 'help' to list commands, or tap a suggestion below."));

  terminal.classList.add("is-interactive");
  inputLine.hidden = false;
  chips.hidden = false;
  renderPrompt();

  input.addEventListener("keydown", onKeyDown);

  // Click anywhere in the terminal to type, unless selecting text or following a link.
  body.addEventListener("click", (e) => {
    if (String(window.getSelection()).length || e.target.closest("a")) return;
    input.focus({ preventScroll: true });
  });

  chips.addEventListener("click", (e) => {
    const chip = e.target.closest("button[data-cmd]");
    if (!chip) return;
    submit(chip.dataset.cmd);
    // Don't pop the on-screen keyboard on touch devices.
    if (window.matchMedia("(pointer: fine)").matches) input.focus({ preventScroll: true });
  });

  if (window.matchMedia("(pointer: fine)").matches) input.focus({ preventScroll: true });
  scrollToBottom();
}

init();
