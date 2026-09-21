# Local web development

Install Node.js 24+ and npm, then run from the repository root:

```sh
make dev
```

Once the server is ready, the browser opens **https://sandflow.localhost**.
The first run installs the pinned Portless 0.15.6 tool in `scripts/portless/`.
It shares the local proxy and certificate trust with the other Sandflow projects.
On a new machine, trusting the CA and binding port 443 may require sudo.
Linux Chrome/Chromium also needs `certutil` (`libnss3-tools` on Debian/Ubuntu).
Regular development startup does not run Certbot.

No `config.env`, Docker, or system Nginx installation is required. This entry point
serves the website only; it does not create system users, configure SSH or email,
or run the server setup scripts.

## Pages and live reload

| URL | Source |
| --- | --- |
| `/` | `share/templates/index.html.tmpl`, with instructions from `README` |
| `/favicon.ico` | `share/favicon.ico` |
| `/~username/` | `users/username/public_html/index.html` |

The homepage lists directories under `users/`. If a user has no `public_html/`
directory yet, their page previews the existing `share/skel/public_html/` template.
Create `users/username/public_html/index.html` to develop an individual page;
place its CSS, images and other public assets in that directory.
The server does not expose SSH keys, `config.env`, or other repository files.

Changes to templates, `README`, the user list and public assets automatically
reload the browser. User links are relative, so they stay on the current local
domain. The preview reads source files directly and does not write to `dist/`,
`/home`, or `/var/www`.

## Commands

```sh
OPEN=0 make dev                  # Skip opening the browser
PORTLESS=0 make dev              # Serve directly at http://127.0.0.1:5173
PORT=5180 make dev-raw           # Choose a direct HTTP port
PORTLESS_PORT=14443 make dev     # Choose an HTTPS proxy port
make dev-trust                  # Repair local Portless certificate trust
make test-dev                   # Test routes, file boundaries and live reload
```

Projects sharing a Portless proxy should use the same proxy port. Press `Ctrl+C`
to stop this server and release its route; the proxy remains available to other
projects. `PORTLESS_BIN` can point to an existing Portless CLI file.

Launcher regression tests, after the local tool has been installed:

```sh
node --test scripts/portless.test.mjs scripts/portless-trust.test.mjs
```

## Server setup

The original server setup and deployment commands remain available separately.
They still require an explicit `config.env`. Web development does not invoke them.
