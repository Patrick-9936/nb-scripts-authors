import test from "node:test";
import assert from "node:assert/strict";
import { Api, ApiError, Jar } from "../src/api.mjs";

test("the cookie jar keeps, replaces and clears cookies", () => {
  const jar = new Jar();
  const absorb = lines => jar.absorb({ headers: { getSetCookie: () => lines } });
  absorb(["session=abc; Path=/; HttpOnly"]);
  assert.equal(jar.header(), "session=abc");
  absorb(["session=def; Path=/"]);
  assert.equal(jar.header(), "session=def");
  absorb(["session=; Path=/; Max-Age=0"]);
  assert.equal(jar.header(), "");
});

test("a joined Set-Cookie header is split without breaking expiry dates", () => {
  const jar = new Jar();
  jar.absorb({ headers: { get: () => "a=1; Expires=Wed, 21 Oct 2026 07:28:00 GMT, b=2; Path=/" } });
  assert.equal(jar.cookies.a, "1");
  assert.equal(jar.cookies.b, "2");
});

test("a login 401 reports wrong credentials, a session 401 reports expiry", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ error: "invalid" }), { status: 401, headers: { "content-type": "application/json" } });
    const api = new Api({ base: "https://example.test/api" });
    await assert.rejects(() => api.login("user", "wrong"), error => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, 401);
      assert.match(error.message, /Неверное имя пользователя или пароль/);
      return true;
    });
    await assert.rejects(() => api.me(), error => {
      assert.match(error.message, /Сессия завершена/);
      return true;
    });
  } finally { globalThis.fetch = original; }
});

test("transient failures are retried, permanent ones are not", async () => {
  const original = globalThis.fetch;
  try {
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      if (calls < 3) return new Response("{}", { status: 503, headers: { "content-type": "application/json" } });
      return new Response(JSON.stringify({ user_id: "11111111-2222-3333-4444-555555555555", username: "x" }), { headers: { "content-type": "application/json" } });
    };
    const api = new Api({ base: "https://example.test/api" });
    const me = await api.me();
    assert.equal(calls, 3, "a 503 must be retried");
    assert.equal(me.uuid, "11111111-2222-3333-4444-555555555555");

    calls = 0;
    globalThis.fetch = async () => { calls += 1; return new Response(JSON.stringify({ error: "nope" }), { status: 404, headers: { "content-type": "application/json" } }); };
    await assert.rejects(() => api.script("11111111-2222-3333-4444-555555555555"));
    assert.equal(calls, 1, "a 404 must not be retried");
  } finally { globalThis.fetch = original; }
});

test("a share refusal explains the unverified author", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ error: "author does not have connect" }), { status: 400, headers: { "content-type": "application/json" } });
    const api = new Api({ base: "https://example.test/api" });
    await assert.rejects(() => api.shareToken("11111111-2222-3333-4444-555555555555"), error => {
      assert.match(error.message, /автор не подтверждён/);
      return true;
    });
  } finally { globalThis.fetch = original; }
});
