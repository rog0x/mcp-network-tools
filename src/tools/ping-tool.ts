import https from "node:https";
import http from "node:http";
import { URL } from "node:url";

interface PingResult {
  url: string;
  requests: number;
  results: Array<{
    attempt: number;
    statusCode: number;
    latencyMs: number;
  }>;
  stats: {
    avgMs: number;
    minMs: number;
    maxMs: number;
    p95Ms: number;
    successRate: number;
  };
  timestamp: string;
}

function singlePing(
  url: string,
  timeoutMs: number
): Promise<{ statusCode: number; latencyMs: number }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const client = parsed.protocol === "https:" ? https : http;
    const start = performance.now();

    const req = client.get(
      url,
      {
        timeout: timeoutMs,
        headers: {
          "User-Agent": "mcp-network-tools/1.0",
        },
      },
      (res) => {
        const latencyMs = Math.round((performance.now() - start) * 100) / 100;
        // Consume response data to free memory
        res.resume();
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode || 0,
            latencyMs,
          });
        });
      }
    );

    req.on("error", (err) => {
      reject(err);
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timed out"));
    });
  });
}

function percentile(sorted: number[], p: number): number {
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

export async function httpPing(
  url: string,
  count: number = 5,
  timeoutMs: number = 10000
): Promise<PingResult> {
  const safeCount = Math.min(Math.max(1, count), 20);

  const results: Array<{
    attempt: number;
    statusCode: number;
    latencyMs: number;
  }> = [];

  for (let i = 0; i < safeCount; i++) {
    try {
      const { statusCode, latencyMs } = await singlePing(url, timeoutMs);
      results.push({ attempt: i + 1, statusCode, latencyMs });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ attempt: i + 1, statusCode: 0, latencyMs: -1 });
    }
  }

  const successfulLatencies = results
    .filter((r) => r.latencyMs >= 0)
    .map((r) => r.latencyMs)
    .sort((a, b) => a - b);

  const successCount = successfulLatencies.length;

  const stats = {
    avgMs:
      successCount > 0
        ? Math.round(
            (successfulLatencies.reduce((a, b) => a + b, 0) / successCount) *
              100
          ) / 100
        : -1,
    minMs: successCount > 0 ? successfulLatencies[0] : -1,
    maxMs:
      successCount > 0 ? successfulLatencies[successCount - 1] : -1,
    p95Ms: successCount > 0 ? percentile(successfulLatencies, 95) : -1,
    successRate:
      Math.round((successCount / safeCount) * 10000) / 100,
  };

  return {
    url,
    requests: safeCount,
    results,
    stats,
    timestamp: new Date().toISOString(),
  };
}
