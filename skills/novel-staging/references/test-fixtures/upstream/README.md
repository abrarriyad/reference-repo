# Upstream artifact fixtures

These JSON files are **copies** of upstream skill samples, used only as input by `scripts/selftest.mjs` and the bundled sample, so that this skill can be copied away alone and still run its self-test.

- `渡口-script.json` ← `novel-script/examples/渡口-script.json`
- `渡口-art.json` ← `novel-art/examples/渡口-art.json`
- `渡口-outline.json` ← `novel-outline/examples/渡口-outline.json`

- They are not this skill's samples; do not cite them as samples in documentation; this skill's sample is `examples/渡口-staging.json`
- If an upstream sample changes its fields, these do not follow automatically. When needed, re-copy the whole file, then re-run the self-test
