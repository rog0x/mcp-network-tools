import * as dns from "node:dns";
import { promisify } from "node:util";

const resolve4 = promisify(dns.resolve4);
const resolve6 = promisify(dns.resolve6);
const resolveMx = promisify(dns.resolveMx);
const resolveTxt = promisify(dns.resolveTxt);
const resolveNs = promisify(dns.resolveNs);
const resolveCname = promisify(dns.resolveCname);
const resolveSoa = promisify(dns.resolveSoa);
const reverseLookup = promisify(dns.reverse);

interface DnsLookupResult {
  domain: string;
  records: Record<string, unknown>;
  timestamp: string;
}

interface ReverseDnsResult {
  ip: string;
  hostnames: string[];
  timestamp: string;
}

async function safeResolve<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

export async function dnsLookup(
  domain: string,
  recordTypes?: string[]
): Promise<DnsLookupResult> {
  const types = recordTypes?.map((t) => t.toUpperCase()) ?? [
    "A",
    "AAAA",
    "MX",
    "TXT",
    "NS",
    "CNAME",
    "SOA",
  ];

  const records: Record<string, unknown> = {};

  const resolvers: Record<string, () => Promise<unknown>> = {
    A: () => resolve4(domain),
    AAAA: () => resolve6(domain),
    MX: () => resolveMx(domain),
    TXT: () => resolveTxt(domain),
    NS: () => resolveNs(domain),
    CNAME: () => resolveCname(domain),
    SOA: () => resolveSoa(domain),
  };

  await Promise.all(
    types.map(async (type) => {
      const resolver = resolvers[type];
      if (resolver) {
        const result = await safeResolve(resolver);
        if (result !== null) {
          records[type] = result;
        }
      }
    })
  );

  return {
    domain,
    records,
    timestamp: new Date().toISOString(),
  };
}

export async function reverseDns(ip: string): Promise<ReverseDnsResult> {
  const hostnames = await reverseLookup(ip);
  return {
    ip,
    hostnames,
    timestamp: new Date().toISOString(),
  };
}

export async function checkPropagation(
  domain: string,
  recordType: string = "A"
): Promise<{
  domain: string;
  recordType: string;
  servers: Record<string, unknown>;
  consistent: boolean;
  timestamp: string;
}> {
  const dnsServers: Record<string, string> = {
    "Google": "8.8.8.8",
    "Cloudflare": "1.1.1.1",
    "OpenDNS": "208.67.222.222",
    "Quad9": "9.9.9.9",
  };

  const resolver = new dns.Resolver();
  const resolveWithServer = promisify(resolver.resolve.bind(resolver));

  const results: Record<string, unknown> = {};
  const allRecords: string[] = [];

  for (const [name, server] of Object.entries(dnsServers)) {
    try {
      resolver.setServers([server]);
      const records = await resolveWithServer(domain, recordType);
      results[name] = { server, records };
      allRecords.push(JSON.stringify(records));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      results[name] = { server, error: message };
    }
  }

  const uniqueResults = new Set(allRecords);

  return {
    domain,
    recordType,
    servers: results,
    consistent: uniqueResults.size <= 1,
    timestamp: new Date().toISOString(),
  };
}
