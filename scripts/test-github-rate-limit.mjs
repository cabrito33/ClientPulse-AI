#!/usr/bin/env node

/**
 * ==============================================================================
 * ClientPulse AI — GitHub Projects v2 Rate Limit Tests (BE-08)
 * File: scripts/test-github-rate-limit.mjs
 *
 * ACCEPTANCE CRITERIA:
 * 1. Deteta limites do GitHub (403/429 com Retry-After, x-ratelimit-remaining: 0,
 *    erros GraphQL do tipo RATE_LIMITED e secondary rate limit).
 * 2. Respeita Retry-After ou x-ratelimit-reset (teto máximo de 20s no total).
 * 3. Repete até 2 vezes com backoff exponencial e jitter.
 * 4. Devolve erro GITHUB_RATE_LIMITED com mensagem em PT-PT quando o limite persiste.
 * ==============================================================================
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  executeGitHubGraphQL,
  detectGitHubRateLimit,
  GitHubRateLimitError,
} from "../supabase/functions/_shared/github.ts";

test("BE-08: detectGitHubRateLimit detects all primary and secondary rate limit signals", () => {
  // 1. HTTP 429
  const res429 = detectGitHubRateLimit(429, { "retry-after": "5" });
  assert.equal(res429.isRateLimited, true);
  assert.equal(res429.retryAfterSeconds, 5);

  // 2. HTTP 403 with x-ratelimit-remaining: 0
  const res403Headers = detectGitHubRateLimit(403, {
    "x-ratelimit-remaining": "0",
    "x-ratelimit-reset": "1700000100",
  });
  assert.equal(res403Headers.isRateLimited, true);
  assert.equal(res403Headers.resetEpochSeconds, 1700000100);

  // 3. HTTP 403 with secondary rate limit body message
  const res403Body = detectGitHubRateLimit(403, {}, {
    message: "You have exceeded a secondary rate limit. Please wait a few minutes.",
  });
  assert.equal(res403Body.isRateLimited, true);

  // 4. GraphQL response with RATE_LIMITED error type
  const resGqlType = detectGitHubRateLimit(200, {}, {
    errors: [{ type: "RATE_LIMITED", message: "API rate limit exceeded" }],
  });
  assert.equal(resGqlType.isRateLimited, true);

  // 5. Normal response is not rate limited
  const resNormal = detectGitHubRateLimit(200, { "x-ratelimit-remaining": "4950" }, {
    data: { viewer: { login: "test" } },
  });
  assert.equal(resNormal.isRateLimited, false);
});

test("BE-08: Rate limit with Retry-After header waits and succeeds on retry", async () => {
  let attemptCount = 0;
  const sleepCalls = [];

  const mockFetch = async () => {
    attemptCount++;
    if (attemptCount === 1) {
      // 1.º tentativa: 429 com Retry-After de 2 segundos
      return new Response(JSON.stringify({ message: "Too many requests" }), {
        status: 429,
        headers: { "retry-after": "2" },
      });
    }

    // 2.ª tentativa: Sucesso
    return new Response(
      JSON.stringify({ data: { viewer: { login: "recovered-user" } } }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      }
    );
  };

  const mockSleep = async (ms) => {
    sleepCalls.push(ms);
  };

  const validQuery = `query { viewer { login } }`;
  const result = await executeGitHubGraphQL("ghp_dummy_token_1234567890", validQuery, {}, {
    fetchFn: mockFetch,
    sleepFn: mockSleep,
    maxRetries: 2,
    maxTotalWaitMs: 20000,
  });

  assert.equal(attemptCount, 2, "Deverá ter tentado 2 vezes");
  assert.deepEqual(sleepCalls, [2000], "Deverá ter esperado 2000ms respeitando o cabeçalho Retry-After: 2");
  assert.equal(result.viewer.login, "recovered-user");
});

test("BE-08: Persistent rate limit throws GITHUB_RATE_LIMITED in PT-PT after exhausting retries", async () => {
  let attemptCount = 0;
  const sleepCalls = [];

  const mockFetch = async () => {
    attemptCount++;
    return new Response(
      JSON.stringify({
        message: "You have exceeded a secondary rate limit. Please wait a few minutes before you try again.",
      }),
      {
        status: 403,
        headers: { "x-ratelimit-remaining": "0" },
      }
    );
  };

  const mockSleep = async (ms) => {
    sleepCalls.push(ms);
  };

  const validQuery = `query { viewer { login } }`;

  await assert.rejects(
    async () => {
      await executeGitHubGraphQL("ghp_dummy_token_1234567890", validQuery, {}, {
        fetchFn: mockFetch,
        sleepFn: mockSleep,
        maxRetries: 2,
        maxTotalWaitMs: 20000,
      });
    },
    (err) => {
      assert.ok(err instanceof GitHubRateLimitError, "Deve ser instância de GitHubRateLimitError");
      assert.equal(err.code, "GITHUB_RATE_LIMITED", "Código de erro deve ser GITHUB_RATE_LIMITED");
      assert.equal(
        err.message,
        "O GitHub limitou temporariamente os pedidos. Tenta de novo dentro de alguns minutos.",
        "Mensagem deve ser em PT-PT conforme especificado"
      );
      return true;
    }
  );

  assert.equal(attemptCount, 3, "Tentativa inicial + 2 repetições = 3 chamadas");
  assert.equal(sleepCalls.length, 2, "Deverá ter pausado 2 vezes antes de desistir");
});

test("BE-08: Exponential backoff with jitter succeeds on second attempt", async () => {
  let attemptCount = 0;
  const sleepCalls = [];

  const mockFetch = async () => {
    attemptCount++;
    if (attemptCount === 1) {
      // 1.ª tentativa: 403 por secondary rate limit sem Retry-After (aciona backoff exponencial + jitter)
      return new Response(
        JSON.stringify({ message: "You have exceeded a secondary rate limit." }),
        { status: 403, headers: {} }
      );
    }

    return new Response(
      JSON.stringify({ data: { viewer: { login: "second-try-success" } } }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  };

  const mockSleep = async (ms) => {
    sleepCalls.push(ms);
  };

  const validQuery = `query { viewer { login } }`;
  const result = await executeGitHubGraphQL("ghp_dummy_token_1234567890", validQuery, {}, {
    fetchFn: mockFetch,
    sleepFn: mockSleep,
    maxRetries: 2,
  });

  assert.equal(attemptCount, 2, "Deve ter tido sucesso na 2.ª tentativa");
  assert.equal(sleepCalls.length, 1, "Deverá ter executado 1 espera de backoff");
  // Backoff para attempt 0 é 1000ms + jitter (0-500ms)
  assert.ok(sleepCalls[0] >= 1000 && sleepCalls[0] <= 1500, `Espera deve estar entre 1000ms e 1500ms, foi ${sleepCalls[0]}ms`);
  assert.equal(result.viewer.login, "second-try-success");
});

test("BE-08: Aborts immediately if required wait time exceeds the 20s total cap", async () => {
  let attemptCount = 0;
  const sleepCalls = [];

  const mockFetch = async () => {
    attemptCount++;
    // Exige 25 segundos de Retry-After (superior ao teto de 20s)
    return new Response(JSON.stringify({ message: "Too many requests" }), {
      status: 429,
      headers: { "retry-after": "25" },
    });
  };

  const mockSleep = async (ms) => {
    sleepCalls.push(ms);
  };

  const validQuery = `query { viewer { login } }`;

  await assert.rejects(
    async () => {
      await executeGitHubGraphQL("ghp_dummy_token_1234567890", validQuery, {}, {
        fetchFn: mockFetch,
        sleepFn: mockSleep,
        maxRetries: 2,
        maxTotalWaitMs: 20000,
      });
    },
    (err) => {
      assert.equal(err.code, "GITHUB_RATE_LIMITED");
      return true;
    }
  );

  assert.equal(attemptCount, 1, "Não deve esperar quando o tempo excede o teto de 20s");
  assert.equal(sleepCalls.length, 0, "Nenhum sleep executado pois excedeu 20s");
});
