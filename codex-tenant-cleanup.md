# Legacy Database Cleanup

This repository previously used tenant-style naming inherited from an old boilerplate.

For Yeshua Academy Finance, cleanup means removing legacy `openfund` resources only after the new standalone deployment has been verified:

1. Confirm `finance.yeshua.academy` is healthy.
2. Confirm production runtime points to `finance.finance`.
3. Confirm row counts and key tables match the migrated data.
4. Only then consider removing legacy resources such as:
   - old DNS record `openfund.yeshua.academy`
   - legacy database `openfund`
   - legacy role `openfund_user`
   - unused legacy schema `ya_finance_schema`

Do not remove legacy resources before verification.
