<!--
One change per pull request (Constitution VI). If the title needs "and", it is
two pull requests. Sequential work is stacked: base this PR on the previous one.
-->

## What changed

<!-- The single change, in a sentence or two. -->

## Why

<!-- The problem it solves. If it fixes a defect, say what the defect did, not
     just that it existed. -->

## How it was verified

<!-- Required. Commands run, what they reported, and anything checked by hand.
     An unverified claim in a PR body is worse than no claim. -->

- [ ] `npm run format:check` and `npm run lint:js`
- [ ] `npm run lint` (astro check)
- [ ] `npm run build`
- [ ] `npm test` (browser smoke suite)
- [ ] Checked in the browser, if the change is visible

## Notes for the reviewer

<!-- Trade-offs taken, anything deliberately left out, decisions you want
     challenged. Delete if there are none. -->
