# LLM Email Dashboard

Tenant template used by [registermysite.com](https://registermysite.com) after a domain is purchased.

This Worker is the production copy of the Email Studio demo:

- Account register / sign-in (D1 + HttpOnly session cookie)
- First user (or `ADMIN_EMAILS`) becomes admin
- Forced OTP / password path is handled by the parent platform before the customer lands here
- Workers AI generates Outlook-safe, table-based HTML email templates
- Composer exports that HTML and sends via the Cloudflare Email Service binding
- Admin moderation (suspend / ban / delete) and audit log

Repo: `github.com/RegisterMySite-com/llm-email-dashboard`

## Bindings required at provision time

| Binding | Name | Purpose |
|---|---|---|
| Assets | `ASSETS` | `./public` frontend |
| D1 | `DB` | users, sessions, audit, rate limits |
| Workers AI | `AI` | template generation (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`) |
| Email Sending | `EMAIL` | `env.EMAIL.send(...)` from the tenant domain |

## Vars set per tenant

```
ROOT_DOMAIN=customer-domain.com
DEFAULT_FROM=hello@customer-domain.com
ALLOWED_SENDERS=hello@customer-domain.com,info@customer-domain.com
ADMIN_EMAILS=owner@customer-domain.com
```

`ALLOWED_SENDERS` must match addresses verified on the tenant zone for Email Sending.

## Local development

```bash
npm install
cp .dev.vars.example .dev.vars
npx wrangler d1 create email-studio
# paste database_id into wrangler.toml
npx wrangler d1 execute email-studio --local --file=./schema.sql
npx wrangler dev
```

## Provision from registermysite.com

The parent Worker clones this repo, creates a D1 database, binds Email Sending for the new zone, writes the vars above, and deploys:

```bash
npx wrangler deploy
```

First login on the new domain uses the OTP issued at checkout. After the password reset, this dashboard is the customer’s isolated Email Studio.
