# GitHub publication security review — 2026-10-17

Source-only initial publication. No prior Git history exists in the original project folders.

Excluded: diary SQLite database including WAL/SHM files, all data folders, node_modules, npm cache/logs, screenshots, local test output, environment files and private key files. Original files and diary data remain local. Personal Windows paths were replaced in the publication copy. Credential-pattern scan found no matching secrets; a URL authentication rejection test is a false-positive email match.

Reviewed input validation, external URLs, local-only server binding, CORS headers, static file path boundaries, browser persistence and diary encryption boundaries. Math portal uses innerHTML only with hardcoded game metadata; user search/answers are not inserted as HTML. Public hub has an optional private sibling module: absence is allowed, but module errors remain visible. Diary implementation and data are absent from public repositories. The diary card requires separately cloning the private repository as 일기장 next to math-class-hub.

Validation: hub build and 14 tests passed; PDF 8 tests passed; private diary persistence/conflict/validation/origin test passed using synthetic temporary data; math portal JavaScript syntax checks passed. Isolated public hub without private diary: shell/PDF 200, diary/database/source 404, POST 405. Existing source suites were run with unchanged corresponding publication source; the changed hub server was checked separately in isolation.

Official npm audit for hub and PDF dependency lockfiles: 0 known vulnerabilities, including development dependencies. No new external dependency was introduced. Versions and integrity hashes retained; PDF.js license included. Node PDF test emitted optional canvas/Path2D warnings; text extraction tests passed.

Limits: pattern checks do not prove absence of all secrets; this is a source-publication review, not an approval for Internet-facing deployment. Servers remain loopback-only. Diary passwords cannot be recovered, and automatic lock/password change are not implemented. The private repository contains application source only, not a diary backup. Other app projects must be cloned as sibling folders for cross-project PDF tooling/tests.
