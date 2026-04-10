# Finance Database Automation

This app no longer uses shared-database multi-tenancy.

The target model is:

- database: `finance`
- schema: `finance`
- role: `finance_user`

For production maintenance:

1. Use `SYSTEM_DATABASE_URL` to connect to the maintenance database, typically `postgres`.
2. Create or verify:
   - database `finance`
   - role `finance_user`
   - schema `finance`
3. Grant the application role rights on the `finance` database and schema.
4. Apply Prisma migrations using `DATABASE_URL=.../finance?schema=finance`.
5. Keep old databases in place until the new deployment is verified.

The source of truth for the current legacy deployment is `openfund.openfund`.
