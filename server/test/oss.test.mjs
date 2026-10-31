// OSS V4 签名。基准向量来自阿里云官方 SDK 的单元测试（alibabacloud-oss-python-sdk-v2 tests/unit/signer/test_v4.py，
// Go SDK v2 里是同一组数）：ak / sk、固定时间戳、bucket 与带 + 和 / 的 key、六个查询参数、一堆要签和不要签的头。
// 文档页上的算例密钥是占位符（yourAccessKeySecret），算不出它印的签名，所以只拿它对规范化请求的文本结构。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { canonicalRequest, additionalHeaders, signingKey, authorization, stringToSign, uriEncode, signRegion, isoDate, createOss } from '../src/oss.mjs';

const REGION = 'cn-hangzhou';
// SDK 用例：time.Unix(1702743657).UTC() = 20231216T162057Z；附加头那一例是 1702747512 = 20231216T172512Z
const HEADERS = { 'x-oss-head1': 'value', abc: 'value', ZAbc: 'value', XYZ: 'value', 'content-type': 'text/plain', 'x-oss-content-sha256': 'UNSIGNED-PAYLOAD' };
const QUERY = { param1: 'value1', '+param1': 'value3', '|param1': 'value4', '+param2': '', '|param2': '', param2: '' };
const REQ = { method: 'PUT', bucket: 'bucket', key: '1234+-/123/1.txt', query: QUERY };

test('官方 SDK 向量 ①：普通 PUT，签名逐字相同', () => {
  const date = '20231216T162057Z';
  const canon = canonicalRequest({ ...REQ, headers: { ...HEADERS, 'x-oss-date': date } });
  assert.equal(canon.split('\n')[1], '/bucket/1234%2B-/123/1.txt', '规范化 URI：+ 要编码，/ 保留');
  assert.equal(canon.split('\n')[2], '%2Bparam1=value3&%2Bparam2&%7Cparam1=value4&%7Cparam2&param1=value1&param2', '查询串按编码后的键排序，空值只写键');
  assert.equal(canon.split('\n').slice(3, 7).join('|'), `content-type:text/plain|x-oss-content-sha256:UNSIGNED-PAYLOAD|x-oss-date:${date}|x-oss-head1:value`, 'abc / ZAbc / XYZ 这些头不签');
  const auth = authorization({ accessKeyId: 'ak', accessKeySecret: 'sk', region: REGION, date, canon });
  assert.equal(auth, 'OSS4-HMAC-SHA256 Credential=ak/20231216/cn-hangzhou/oss/aliyun_v4_request,Signature=e21d18daa82167720f9b1047ae7e7f1ce7cb77a31e8203a7d5f4624fa0284afe');
});

test('官方 SDK 向量 ②：带附加头 ZAbc / abc，签名逐字相同', () => {
  const date = '20231216T172512Z';
  const headers = { ...HEADERS, 'x-oss-date': date };
  const add = additionalHeaders(headers, ['ZAbc', 'abc']);
  assert.deepEqual(add, ['abc', 'zabc'], '附加头小写、排序');
  const canon = canonicalRequest({ ...REQ, headers, additional: add });
  assert.ok(canon.includes('\nabc:value\n') && canon.includes('\nzabc:value\n') && canon.includes('\nabc;zabc\n'));
  const auth = authorization({ accessKeyId: 'ak', accessKeySecret: 'sk', region: REGION, date, canon, additional: add });
  assert.equal(auth, 'OSS4-HMAC-SHA256 Credential=ak/20231216/cn-hangzhou/oss/aliyun_v4_request,AdditionalHeaders=abc;zabc,Signature=4a4183c187c07c8947db7620deb0a6b38d9fbdd34187b6dbaccb316fa251212f');
});

test('附加头里本来就必签的（content-type）和请求里没有的，都不进附加头列表', () => {
  assert.deepEqual(additionalHeaders({ 'content-type': 'a', abc: 'v' }, ['content-type', 'abc', 'nope']), ['abc']);
});

test('规范化请求的文本结构与官方文档算例一致（头部段后有空行，再附加头行，再载荷哈希）', () => {
  const date = '20250411T064124Z';
  const headers = { 'content-disposition': 'attachment', 'content-length': '3', 'content-md5': 'ICy5YqxZB1uWSwcVLSNLcA==', 'content-type': 'text/plain', 'x-oss-content-sha256': 'UNSIGNED-PAYLOAD', 'x-oss-date': date };
  const add = additionalHeaders(headers, ['content-disposition', 'content-length']);
  const canon = canonicalRequest({ method: 'PUT', bucket: 'examplebucket', key: 'exampleobject', headers, additional: add });
  assert.equal(canon, ['PUT', '/examplebucket/exampleobject', '',
    'content-disposition:attachment', 'content-length:3', 'content-md5:ICy5YqxZB1uWSwcVLSNLcA==', 'content-type:text/plain', 'x-oss-content-sha256:UNSIGNED-PAYLOAD', `x-oss-date:${date}`,
    '', 'content-disposition;content-length', 'UNSIGNED-PAYLOAD'].join('\n'));
  assert.equal(crypto.createHash('sha256').update(canon).digest('hex'), 'c46d96390bdbc2d739ac9363293ae9d710b14e48081fcb22cd8ad54b63136eca', '文档印的哈希');
  assert.equal(stringToSign(canon, date, REGION).split('\n')[2], '20250411/cn-hangzhou/oss/aliyun_v4_request');
});

test('没有附加头时：bucket 级 HEAD 的规范化 URI 是 /bucket/，Authorization 不带 AdditionalHeaders 段', () => {
  const date = '20250411T064124Z';
  const c = canonicalRequest({ method: 'HEAD', bucket: 'b', key: '', headers: { 'x-oss-date': date, 'x-oss-content-sha256': 'UNSIGNED-PAYLOAD' } });
  assert.equal(c, `HEAD\n/b/\n\nx-oss-content-sha256:UNSIGNED-PAYLOAD\nx-oss-date:${date}\n\n\nUNSIGNED-PAYLOAD`);
  assert.match(authorization({ accessKeyId: 'id', accessKeySecret: 'sk', region: REGION, date, canon: c }),
    /^OSS4-HMAC-SHA256 Credential=id\/20250411\/cn-hangzhou\/oss\/aliyun_v4_request,Signature=[0-9a-f]{64}$/);
});

test('派生密钥是四级 HMAC 链，起点是 "aliyun_v4" + Secret', () => {
  const h = (k, s) => crypto.createHmac('sha256', k).update(s).digest();
  const expected = h(h(h(h('aliyun_v4sk', '20231216'), REGION), 'oss'), 'aliyun_v4_request');
  assert.equal(signingKey('sk', '20231216', REGION).toString('hex'), expected.toString('hex'));
});

test('URI 编码：保留字母数字 -_.~，路径里的 / 可保留，中文按 UTF-8 逐字节大写 %XX，空格不是 +', () => {
  assert.equal(uriEncode('a-b_c.d~e'), 'a-b_c.d~e');
  assert.equal(uriEncode('u_1/成片 01.mp4', true), 'u_1/%E6%88%90%E7%89%87%2001.mp4');
  assert.equal(uriEncode('a/b'), 'a%2Fb');
  assert.equal(uriEncode('x+y'), 'x%2By');
});

test('签名用的 region 去掉 oss- 前缀与 -internal 后缀；日期是 ISO8601 紧凑格式', () => {
  assert.equal(signRegion('oss-cn-hongkong'), 'cn-hongkong');
  assert.equal(signRegion('oss-cn-hongkong-internal'), 'cn-hongkong');
  assert.equal(signRegion('cn-hangzhou'), 'cn-hangzhou');
  assert.equal(isoDate(new Date('2025-04-11T06:41:24.123Z')), '20250411T064124Z');
  assert.equal(isoDate(new Date(1702743657 * 1000)), '20231216T162057Z');
});

test('客户端：没 bucket 或没凭证直接报错；host 按 bucket + endpoint 拼', () => {
  assert.throws(() => createOss({ region: 'oss-cn-hongkong', accessKeyId: 'i', accessKeySecret: 's' }), /配置不全/);
  assert.throws(() => createOss({ bucket: 'b', region: 'oss-cn-hongkong' }), /没有凭证/);
  assert.equal(createOss({ bucket: 'b', region: 'oss-cn-hongkong', accessKeyId: 'i', accessKeySecret: 's' }).host, 'b.oss-cn-hongkong.aliyuncs.com');
  assert.equal(createOss({ bucket: 'b', region: 'oss-cn-hongkong', endpoint: 'oss-cn-hongkong-internal.aliyuncs.com', accessKeyId: 'i', accessKeySecret: 's' }).host, 'b.oss-cn-hongkong-internal.aliyuncs.com');
});

// ---- 临时凭证（实例角色）----
import { instanceRoleCredentials, staticCredentials } from '../src/oss.mjs';

test('官方 SDK 向量 ③：带 security token（实例角色的临时凭证）时 x-oss-security-token 参与签名，签名逐字相同', () => {
  const date = '20231217T034736Z';     // time.Unix(1702784856).UTC()
  const headers = { ...HEADERS, 'x-oss-date': date, 'x-oss-security-token': 'token' };
  const canon = canonicalRequest({ ...REQ, headers });
  assert.ok(canon.includes('\nx-oss-security-token:token\n'));
  const auth = authorization({ accessKeyId: 'ak', accessKeySecret: 'sk', region: REGION, date, canon });
  assert.equal(auth, 'OSS4-HMAC-SHA256 Credential=ak/20231217/cn-hangzhou/oss/aliyun_v4_request,Signature=b94a3f999cf85bcdc00d332fbd3734ba03e48382c36fa4d5af5df817395bd9ea');
});

test('实例角色凭证：先换元数据 token 再取凭证，没到期就复用，快到期才重取', async () => {
  let calls = [], clock = Date.parse('2026-01-01T00:00:00Z');
  const fetchImpl = async (url, init = {}) => {
    calls.push((init.method || 'GET') + ' ' + url.replace('http://100.100.100.200/latest', ''));
    if (url.endsWith('/api/token')) return { ok: true, text: async () => 'meta-token' };
    assert.equal(init.headers['X-aliyun-ecs-metadata-token'], 'meta-token', '取凭证时要带上换来的 token');
    return { ok: true, json: async () => ({ Code: 'Success', AccessKeyId: 'STS.id', AccessKeySecret: 'STS.secret', SecurityToken: 'STS.token', Expiration: new Date(clock + 3600_000).toISOString() }) };
  };
  const creds = instanceRoleCredentials('WowOssRole', { fetchImpl, now: () => clock });
  const a = await creds();
  assert.deepEqual([a.accessKeyId, a.token], ['STS.id', 'STS.token']);
  assert.deepEqual(calls, ['PUT /api/token', 'GET /meta-data/ram/security-credentials/WowOssRole']);
  await creds(); await creds();
  assert.equal(calls.length, 2, '一小时内不该再请求');
  clock += 56 * 60_000;                      // 离到期只剩 4 分钟
  await creds();
  assert.equal(calls.length, 4, '快到期要重新取');
});

test('实例角色凭证：角色没挂上（404）要把原因说清楚', async () => {
  const fetchImpl = async url => url.endsWith('/api/token') ? { ok: false } : { ok: false, status: 404 };
  await assert.rejects(instanceRoleCredentials('Nope', { fetchImpl })(), /没挂上这个 RAM 角色|取不到临时凭证/);
});

test('客户端：有角色名就不要求 AccessKey；两者都没有才报错', () => {
  assert.equal(createOss({ bucket: 'b', region: 'oss-cn-hongkong', role: 'WowOssRole' }).auth, 'role');
  assert.equal(createOss({ bucket: 'b', region: 'oss-cn-hongkong', accessKeyId: 'i', accessKeySecret: 's' }).auth, 'ak');
  assert.throws(() => createOss({ bucket: 'b', region: 'oss-cn-hongkong' }), /没有凭证/);
});

test('静态凭证：原样返回，没有 token', async () => {
  assert.deepEqual(await staticCredentials({ accessKeyId: 'i', accessKeySecret: 's' })(), { accessKeyId: 'i', accessKeySecret: 's', token: '' });
});

// ---- ListObjectsV2 的 XML 解析 ----
import { parseList } from '../src/oss.mjs';
test('parseList：取 Key / Size / LastModified 与翻页标记，XML 实体要还原', () => {
  const xml = `<?xml version="1.0"?><ListBucketResult><Name>b</Name><Prefix>backups/</Prefix><IsTruncated>true</IsTruncated>
    <NextContinuationToken>abc&amp;def</NextContinuationToken>
    <Contents><Key>backups/wow-20261101-033000.tar.gz</Key><LastModified>2026-11-01T03:30:12.000Z</LastModified><ETag>"x"</ETag><Size>12345</Size><StorageClass>Standard</StorageClass></Contents>
    <Contents><Key>u_1/a&amp;b.png</Key><LastModified>2026-10-31T10:00:00.000Z</LastModified><Size>7</Size></Contents>
  </ListBucketResult>`;
  const r = parseList(xml);
  assert.deepEqual(r.objects, [
    { key: 'backups/wow-20261101-033000.tar.gz', size: 12345, lastModified: '2026-11-01T03:30:12.000Z' },
    { key: 'u_1/a&b.png', size: 7, lastModified: '2026-10-31T10:00:00.000Z' },
  ]);
  assert.equal(r.truncated, true);
  assert.equal(r.next, 'abc&def');
  assert.deepEqual(parseList('<ListBucketResult><IsTruncated>false</IsTruncated></ListBucketResult>'), { objects: [], truncated: false, next: '' });
});
