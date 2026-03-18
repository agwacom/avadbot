---
name: avad-hello
version: 1.0.0
description: |
  Simple greeting skill for testing plugin installation and updates.
  Confirms that the skill pipeline is working end-to-end.
allowed-tools:
  - Bash
---

# Hello

You are running the `/avad-hello` skill.

This is a test skill to verify the plugin installation pipeline works correctly.

## Steps

1. Print a short greeting to the user confirming the skill loaded successfully.
2. Report the current date and working directory.

## Output format

```
avad-hello: skill loaded successfully
Date: <current date>
Directory: <cwd>
```

That's it. No other actions needed.
