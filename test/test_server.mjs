import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import PluginExpress from '../nadesiko3-server.mjs';

test('nadesiko3-server plugin test suite', async (t) => {
  // Mock sys object to simulate Nadesiko3 environment
  const sys = {
    vars: {},
    __setSysVar(name, val) {
      this.vars[name] = val;
    },
    __getSysVar(name) {
      return this.vars[name];
    },
    __server: null,
    __webapp: null
  };

  // 1. Initialize plugin
  PluginExpress['初期化'].fn(sys);
  assert.strictEqual(sys.__server, null);
  assert.strictEqual(sys.__webapp, null);

  // 2. Start server on ephemeral port (0) to avoid conflicts
  let port = 0;
  const serverStarted = new Promise((resolve) => {
    sys.__setSysVar('WEBサーバ:ONSUCCESS', (pno) => {
      port = pno;
      resolve();
    });
  });

  const server = PluginExpress['WEBサーバ起動'].fn(0, sys);
  await serverStarted;
  assert.ok(port > 0, `Server should start on a port greater than 0, got ${port}`);
  assert.strictEqual(sys.__server, server);

  // 3. Register and test GET route
  let getCalled = false;
  PluginExpress['WEBサーバGET時'].fn((req, res) => {
    getCalled = true;
    PluginExpress['WEBサーバ出力'].fn('hello from test', sys);
  }, '/test', sys);

  const res = await fetch(`http://localhost:${port}/test`);
  const text = await res.text();
  assert.strictEqual(res.status, 200);
  assert.strictEqual(text, 'hello from test');
  assert.ok(getCalled, 'GET callback should have been called');

  // 4. Register and test POST route with JSON body
  let postCalled = false;
  PluginExpress['WEBサーバPOST時'].fn((req, res) => {
    postCalled = true;
    const postData = sys.__getSysVar('POSTデータ');
    PluginExpress['WEBサーバ出力'].fn(JSON.stringify(postData), sys);
  }, '/post-test', sys);

  const postRes = await fetch(`http://localhost:${port}/post-test`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ message: 'hello nako' })
  });
  const postJson = await postRes.json();
  assert.strictEqual(postRes.status, 200);
  assert.deepStrictEqual(postJson, { message: 'hello nako' });
  assert.ok(postCalled, 'POST callback should have been called');

  // 5. Test Redirect route
  PluginExpress['WEBサーバGET時'].fn((req, res) => {
    PluginExpress['WEBサーバリダイレクト'].fn('/test', sys);
  }, '/redirect-test', sys);

  const redirectRes = await fetch(`http://localhost:${port}/redirect-test`, { redirect: 'manual' });
  assert.strictEqual(redirectRes.status, 302);
  assert.strictEqual(redirectRes.headers.get('location'), '/test');

  // 6. Test Static file serving
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nako3-server-test-'));
  const testFileName = 'hello-static.txt';
  const testFileContent = 'static file test content';
  fs.writeFileSync(path.join(tmpDir, testFileName), testFileContent);

  PluginExpress['WEBサーバ静的パス指定'].fn('/static', tmpDir, sys);

  const staticRes = await fetch(`http://localhost:${port}/static/${testFileName}`);
  const staticText = await staticRes.text();
  assert.strictEqual(staticRes.status, 200);
  assert.strictEqual(staticText, testFileContent);

  // Clean up static file setup
  fs.rmSync(tmpDir, { recursive: true, force: true });

  // 7. Close server
  await new Promise((resolve) => server.close(resolve));
});
