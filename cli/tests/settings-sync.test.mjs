import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULTS } from "../src/params.mjs";
import { localSettingsSnapshot, synchronizeSettings } from "../src/settings-sync.mjs";

const ACCOUNT = "11111111-2222-3333-4444-555555555555";
const AUTHOR = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SCRIPT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PRESET = { name: "Android preset", values: [...DEFAULTS], brawlers: [3], updatedAt: 123 };

function apiFor(response) {
  const calls = [];
  return {
    calls,
    api: {
      identity: { uuid: ACCOUNT, username: "tester" },
      async syncSettings(body, account) {
        calls.push({ body, account });
        return typeof response === "function" ? response(body) : response;
      },
    },
  };
}

test("local snapshot maps block lists and battles, excluding local-only data", () => {
  const snapshot = localSettingsSnapshot({
    favorites: [SCRIPT], recent: [{ uuid: SCRIPT }],
    blockedAuthors: [AUTHOR, "not-a-uuid"], blockedScripts: [SCRIPT],
    battles: { [SCRIPT]: { values: [...DEFAULTS], banned: [9, 2, 9, -1, 1025] } },
  });
  assert.deepEqual(snapshot[`author:${AUTHOR}`], true);
  assert.deepEqual(snapshot[`script:${SCRIPT}`], true);
  assert.deepEqual(snapshot[`battle:${SCRIPT}`], DEFAULTS);
  assert.deepEqual(snapshot[`brawlers:${SCRIPT}`], [2, 9]);
  assert.equal(Object.keys(snapshot).some(key => key.startsWith("favorite") || key.startsWith("recent")), false);
});

test("first sync bootstraps local settings and retains remote preset values", async () => {
  const local = {
    favorites: [SCRIPT], recent: [{ uuid: SCRIPT }], blockedAuthors: [AUTHOR], blockedScripts: [],
    battles: { [SCRIPT]: { values: [...DEFAULTS], banned: [4] } },
  };
  const { api, calls } = apiFor(body => ({ user_uuid: ACCOUNT, values: { ...body.changes, [`preset:${SCRIPT}`]: PRESET }, initialized: true }));
  const result = await synchronizeSettings(api, local);
  assert.equal(calls[0].body.initialize, true);
  assert.equal(calls[0].account, ACCOUNT);
  assert.deepEqual(calls[0].body.changes[`brawlers:${SCRIPT}`], [4]);
  assert.equal("favorites" in calls[0].body.changes, false);
  assert.deepEqual(result.settings.favorites, [SCRIPT]);
  assert.deepEqual(result.settings.recent, [{ uuid: SCRIPT }]);
  assert.deepEqual(result.settings.syncAccounts[ACCOUNT].values[`preset:${SCRIPT}`], PRESET);
  assert.deepEqual(result.settings.battles[SCRIPT].banned, [4]);
});

test("existing remote settings win the initial account bind without uploading guest settings", async () => {
  const remote = {
    [`author:${AUTHOR}`]: false,
    [`script:${SCRIPT}`]: true,
    [`battle:${SCRIPT}`]: [...DEFAULTS],
    [`brawlers:${SCRIPT}`]: [8, 3],
    [`preset:${SCRIPT}`]: PRESET,
  };
  const local = { favorites: [SCRIPT], recent: [], blockedAuthors: [AUTHOR], blockedScripts: [], battles: {} };
  const { api, calls } = apiFor({ user_uuid: ACCOUNT, values: remote, initialized: false });
  const result = await synchronizeSettings(api, local);
  assert.equal(calls[0].body.initialize, true);
  assert.deepEqual(result.settings.blockedAuthors, []);
  assert.deepEqual(result.settings.blockedScripts, [SCRIPT]);
  assert.deepEqual(result.settings.battles[SCRIPT].banned, [3, 8]);
  assert.deepEqual(result.settings.favorites, [SCRIPT]);
  assert.deepEqual(result.settings.syncAccounts[ACCOUNT].values[`preset:${SCRIPT}`], PRESET);
  assert.equal(result.pending, 0);
});

test("later sync sends block removals and brawler changes, while preserving server presets", async () => {
  const previous = {
    [`author:${AUTHOR}`]: true,
    [`battle:${SCRIPT}`]: [...DEFAULTS],
    [`brawlers:${SCRIPT}`]: [2],
    [`preset:${SCRIPT}`]: PRESET,
  };
  const local = {
    syncCurrentAccount: ACCOUNT,
    syncAccounts: { [ACCOUNT]: { known: true, values: previous, pending: {} } },
    favorites: [SCRIPT], recent: [{ uuid: SCRIPT }], blockedAuthors: [], blockedScripts: [],
    battles: { [SCRIPT]: { values: [...DEFAULTS], banned: [2, 7] } },
  };
  const { api, calls } = apiFor(body => ({
    user_uuid: ACCOUNT,
    values: { ...previous, ...body.changes },
    initialized: false,
  }));
  const result = await synchronizeSettings(api, local);
  assert.equal(calls[0].body.initialize, false);
  assert.equal(calls[0].body.changes[`author:${AUTHOR}`], false);
  assert.deepEqual(calls[0].body.changes[`brawlers:${SCRIPT}`], [2, 7]);
  assert.equal("favorites" in calls[0].body.changes, false);
  assert.deepEqual(result.settings.syncAccounts[ACCOUNT].values[`preset:${SCRIPT}`], PRESET);
  assert.equal(result.pending, 0);
});

test("failed sync persists its outbox before the request", async () => {
  const local = { blockedAuthors: [AUTHOR], blockedScripts: [], battles: {}, favorites: [], recent: [] };
  const { api } = apiFor(() => { throw new Error("offline"); });
  let queued;
  await assert.rejects(() => synchronizeSettings(api, local, value => { queued = value; }), /offline/);
  assert.equal(queued.syncAccounts[ACCOUNT].pending[`author:${AUTHOR}`], true);
});
