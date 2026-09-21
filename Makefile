SHELL := /bin/bash

# Web development works without server configuration. Keep it required for setup.
ifeq ($(strip $(filter-out help dev dev-raw dev-trust test-dev,$(MAKECMDGOALS))),)
-include config.env
else
include config.env
endif
export

# Script paths
GATEWAY_SETUP_CERT := scripts/gateway_setup_cert.sh
GATEWAY_SETUP_HOMEPAGE := scripts/gateway_setup_user_homepage_location.sh
INDEX_GENERATE := scripts/index_generate.sh
INDEX_DEPLOY := scripts/index_deploy.sh
USER_SETUP_SKEL := scripts/user_setup_skel.sh
USER_ADD := scripts/user_add.sh
MOTD_SCRIPT := scripts/motd.sh
DOVECOT_SETUP := scripts/dovecot.sh
OPENDKIM_SETUP := scripts/opendkim.sh
POSTFIX_SETUP := scripts/postfix.sh
CRON_CERTBOT_SCRIPT := scripts/cron_certbot.sh
CLEAN_SCRIPT := scripts/clean.sh

# ─── Help ───────────────────────────────────────────────────────
help: ## Show this help message
	@echo "Usage: make [target]"
	@echo ""
	@echo "Local web development (Node.js 24+, no server setup required):"
	@echo "  dev            - Open https://sandflow.localhost through Portless"
	@echo "  dev-raw        - Serve directly at http://127.0.0.1:5173"
	@echo "  dev-trust      - Synchronize Portless certificate trust"
	@echo "  test-dev       - Run web development server tests"
	@echo "  Guide: docs/development.md"
	@echo ""
	@echo "Initial server setup (run in order):"
	@echo "  setup-gateway   - Install nginx, certbot, configure TLS & user homepages"
	@echo "  setup-motd      - Install dynamic MOTD"
	@echo "  setup-dovecot   - Install and configure Dovecot (IMAP/POP3/SASL)"
	@echo "  setup-opendkim  - Install and configure OpenDKIM (mail signing)"
	@echo "  setup-email     - Install and configure Postfix (depends on Dovecot SASL)"
	@echo "  setup-users     - Install skel template for new users"
	@echo "  setup-index     - Generate and deploy the main index page"
	@echo "  setup-cron      - Schedule certbot auto-renewal"
	@echo ""
	@echo "User management:"
	@echo "  add-user USER=<name> KEY=<path>  - Create a user with SSH key"
	@echo ""
	@echo "Maintenance:"
	@echo "  generate-index  - Regenerate index.html to dist/"
	@echo "  deploy-index    - Deploy dist/ to web root"
	@echo "  clean           - Remove dist/ directory"

# ─── Local Web Development ─────────────────────────────────────
dev:
	node scripts/portless.mjs web

dev-raw:
	node scripts/dev-web.mjs

dev-trust:
	node scripts/portless.mjs trust

test-dev:
	node --test scripts/dev-web.test.mjs

# ─── Full Setup ─────────────────────────────────────────────────
#   gateway → motd → dovecot → opendkim → email → users → index → cron
all: setup-gateway setup-motd setup-dovecot setup-opendkim setup-email setup-users setup-index setup-cron

# ─── Gateway ────────────────────────────────────────────────────
setup-gateway:
	$(SHELL) $(GATEWAY_SETUP_CERT)
	$(SHELL) $(GATEWAY_SETUP_HOMEPAGE)

# ─── Index ──────────────────────────────────────────────────────
setup-index: generate-index deploy-index

generate-index:
	$(SHELL) $(INDEX_GENERATE)

deploy-index:
	$(SHELL) $(INDEX_DEPLOY)

# ─── Users ──────────────────────────────────────────────────────
setup-users:
	$(SHELL) $(USER_SETUP_SKEL)

add-user:
	@if [ -z "$(USER)" ] || [ -z "$(KEY)" ]; then \
		echo "Usage: make add-user USER=<username> KEY=<path/to/pubkey>"; \
		exit 1; \
	fi
	$(SHELL) $(USER_ADD) $(USER) $(KEY)

# ─── MOTD ───────────────────────────────────────────────────────
setup-motd:
	$(SHELL) $(MOTD_SCRIPT)

# ─── Dovecot ────────────────────────────────────────────────────
setup-dovecot:
	$(SHELL) $(DOVECOT_SETUP)

# ─── OpenDKIM ───────────────────────────────────────────────────
setup-opendkim:
	$(SHELL) $(OPENDKIM_SETUP)

# ─── Email ──────────────────────────────────────────────────────
setup-email:
	$(SHELL) $(POSTFIX_SETUP)

# ─── Cron ───────────────────────────────────────────────────────
setup-cron:
	$(SHELL) $(CRON_CERTBOT_SCRIPT)

# ─── Clean ──────────────────────────────────────────────────────
clean:
	$(SHELL) $(CLEAN_SCRIPT)

.PHONY: all help dev dev-raw dev-trust test-dev \
        setup-gateway setup-index generate-index deploy-index \
        setup-users add-user setup-motd setup-dovecot setup-opendkim setup-email setup-cron \
        clean
