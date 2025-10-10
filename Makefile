SHELL := /bin/bash

# Load configuration
include config.env
export

GATEWAY_SETUP_CERT := scripts/gateway_setup_cert.sh
GATEWAY_SETUP_HOMEPAGE := scripts/gateway_setup_user_homepage_location.sh
INDEX_GENERATE := scripts/index_generate.sh
INDEX_DEPLOY := scripts/index_deploy.sh
USER_SETUP_SKEL := scripts/user_setup_skel.sh
MOTD_SCRIPT := scripts/motd.sh
POSTFIX_SETUP := scripts/postfix.sh
CRON_CERTBOT_SCRIPT := scripts/cron_certbot.sh
CLEAN_SCRIPT := scripts/clean.sh

all: gateway index user motd email cron

gateway:
	$(SHELL) $(GATEWAY_SETUP_CERT)
	$(SHELL) $(GATEWAY_SETUP_HOMEPAGE)

index:
	$(SHELL) $(INDEX_GENERATE)
	$(SHELL) $(INDEX_DEPLOY)

user:
	$(SHELL) $(USER_SETUP_SKEL)

motd:
	$(SHELL) $(MOTD_SCRIPT)

email:
	$(SHELL) $(POSTFIX_SETUP)

cron:
	$(SHELL) $(CRON_CERTBOT_SCRIPT)

clean:
	$(SHELL) $(CLEAN_SCRIPT)

.PHONY: all gateway index user motd email cron clean
