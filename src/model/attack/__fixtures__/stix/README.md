# Attack Flow and STIX 2.1 schemas (test fixtures)

Used only by `attackFlow.test.ts` to validate the Attack Flow export. Not shipped in the app.

- `attack-flow-schema-2.0.0.json`, `attack-flow-extension-2.0.0.json`: from
  [center-for-threat-informed-defense/attack-flow](https://github.com/center-for-threat-informed-defense/attack-flow)
  at tag `v4.1.0`, folder `stix/`. Apache-2.0.
- `oasis-open/`: the STIX 2.1 JSON schemas those files refer to, from the same folder of that tag,
  which copies [oasis-open/cti-stix2-json-schemas](https://github.com/oasis-open/cti-stix2-json-schemas).
  BSD-3-Clause.

The files are unchanged. The test adjusts two things in memory: each `$schema` is set to the
draft 2020-12 URL that ajv knows, and the timestamp schema is also registered under the `master`
branch URL that the Attack Flow schema uses.
