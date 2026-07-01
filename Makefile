SHELL := /bin/bash

# Load configuration
include config.env
export

# Script paths
GATEWAY_SETUP_CERT := scripts/gateway_setup_cert.sh
GATEWAY_SETUP_HOMEPAGE := scripts/gateway_setup_user_homepage_location.sh
INDEX_GENERATE := scripts/index_generate.sh
INDEX_DEPLOY := scripts/index_deploy.sh
USER_SETUP_SKEL := scripts/user_setup_skel.sh
USER_ADD := scripts/user_add.sh
MOTD_SCRIPT := scripts/motd.sh
POSTFIX_SETUP := scripts/postfix.sh
CRON_CERTBOT_SCRIPT := scripts/cron_certbot.sh
CLEAN_SCRIPT := scripts/clean.sh

# ─── Help ───────────────────────────────────────────────────────
help: ## Show this help message
	@echo "Usage: make [target]"
	@echo ""
	@echo "Initial server setup (run in order):"
	@echo "  setup-gateway   - Install nginx, certbot, configure TLS & user homepages"
	@echo "  setup-index     - Generate and deploy the main index page"
	@echo "  setup-users     - Install skel template for new users"
	@echo "  setup-motd      - Install dynamic MOTD"
	@echo "  setup-email     - Install and configure Postfix"
	@echo "  setup-cron      - Schedule certbot auto-renewal"
	@echo ""
	@echo "User management:"
	@echo "  add-user USER=<name> KEY=<path>  - Create a user with SSH key"
	@echo ""
	@echo "Maintenance:"
	@echo "  generate-index  - Regenerate index.html to dist/"
	@echo "  deploy-index    - Deploy dist/ to web root"
	@echo "  clean           - Remove dist/ directory"

# ─── Full Setup ─────────────────────────────────────────────────
all: setup-gateway setup-index setup-users setup-motd setup-email setup-cron

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

# ─── Email ──────────────────────────────────────────────────────
setup-email:
	$(SHELL) $(POSTFIX_SETUP)

# ─── Cron ───────────────────────────────────────────────────────
setup-cron:
	$(SHELL) $(CRON_CERTBOT_SCRIPT)

# ─── Clean ──────────────────────────────────────────────────────
clean:
	$(SHELL) $(CLEAN_SCRIPT)

.PHONY: all help \
        setup-gateway setup-index generate-index deploy-index \
        setup-users add-user setup-motd setup-email setup-cron \
        clean
