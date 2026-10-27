# personal_website

Personal portfolio site, served with GitHub Pages.

Plain HTML/CSS/JS with no build step, no dependencies and no third-party requests.

```
index.html             # all page content
assets/css/style.css   # theme + layout
assets/js/main.js      # copy-email button, nav highlight, footer year
.nojekyll              # tells Pages to serve files as-is (skip Jekyll)
```

## Local preview

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploying

1. Repo **Settings → Pages → Build and deployment**
2. Source: **Deploy from a branch**, Branch: `main`, folder `/ (root)`
3. Check **Enforce HTTPS**

The site is published at `https://jicxer.github.io/personal_website/`.

## Security notes

- **CSP via `<meta>`**: Pages can't set response headers, so the policy lives in `index.html`.
  It allows only same-origin scripts and styles, which means no inline JS, no inline
  `style=""` attributes and no CDNs. If you add something external, update the CSP on purpose.
- **No third parties**: no web fonts, analytics or CDNs, so visitors' IPs aren't leaked to anyone but GitHub.
- **External links** use `rel="noopener noreferrer"` to prevent reverse tabnabbing.
- **Email**: the address is split across `data-user` / `data-domain` and only assembled on click,
  which deters naive scrapers.
- Headers a meta CSP *can't* provide (`frame-ancestors`, HSTS, `X-Content-Type-Options`) would need
  a proxy/CDN in front of Pages (e.g. Cloudflare) if you ever want them.
