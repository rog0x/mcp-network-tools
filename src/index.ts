#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { dnsLookup, reverseDns, checkPropagation } from "./tools/dns-lookup.js";
import { getIpInfo } from "./tools/ip-info.js";
import { checkSsl } from "./tools/ssl-checker.js";
import { whoisLookup } from "./tools/whois-lookup.js";
import { httpPing } from "./tools/ping-tool.js";

const server = new Server(
  {
    name: "mcp-network-tools",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "dns_lookup",
      description:
        "Resolve a domain name to DNS records (A, AAAA, MX, TXT, NS, CNAME, SOA). Supports reverse DNS and propagation checking.",
      inputSchema: {
        type: "object" as const,
        properties: {
          domain: {
            type: "string",
            description: "Domain name to look up (e.g. example.com)",
          },
          record_types: {
            type: "array",
            items: { type: "string" },
            description:
              "Record types to query (default: all). Options: A, AAAA, MX, TXT, NS, CNAME, SOA",
          },
          mode: {
            type: "string",
            enum: ["resolve", "reverse", "propagation"],
            description:
              "Mode: 'resolve' (default) for forward DNS, 'reverse' for reverse DNS (pass IP in domain), 'propagation' to check across public DNS servers",
          },
        },
        required: ["domain"],
      },
    },
    {
      name: "ip_info",
      description:
        "Get geolocation and network information for an IP address: country, city, ISP, ASN, coordinates. Supports IPv4 and IPv6.",
      inputSchema: {
        type: "object" as const,
        properties: {
          ip: {
            type: "string",
            description: "IPv4 or IPv6 address to look up",
          },
        },
        required: ["ip"],
      },
    },
    {
      name: "ssl_check",
      description:
        "Check the SSL/TLS certificate of a host: validity, issuer, expiry date, days until expiry, subject alternative names, certificate chain, cipher, and protocol.",
      inputSchema: {
        type: "object" as const,
        properties: {
          host: {
            type: "string",
            description: "Hostname to check (e.g. example.com)",
          },
          port: {
            type: "number",
            description: "Port number (default: 443)",
          },
        },
        required: ["host"],
      },
    },
    {
      name: "whois_lookup",
      description:
        "Look up WHOIS information for a domain: registrar, creation date, expiry date, nameservers, and domain status.",
      inputSchema: {
        type: "object" as const,
        properties: {
          domain: {
            type: "string",
            description: "Domain name to look up (e.g. example.com)",
          },
        },
        required: ["domain"],
      },
    },
    {
      name: "http_ping",
      description:
        "Measure HTTP response time to a URL over multiple requests. Returns per-request latency and statistics: average, min, max, p95, and success rate.",
      inputSchema: {
        type: "object" as const,
        properties: {
          url: {
            type: "string",
            description: "URL to ping (e.g. https://example.com)",
          },
          count: {
            type: "number",
            description: "Number of requests to send (default: 5, max: 20)",
          },
          timeout_ms: {
            type: "number",
            description: "Timeout per request in milliseconds (default: 10000)",
          },
        },
        required: ["url"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "dns_lookup": {
        const domain = args?.domain as string;
        const mode = (args?.mode as string) || "resolve";
        const recordTypes = args?.record_types as string[] | undefined;

        let result: unknown;
        switch (mode) {
          case "reverse":
            result = await reverseDns(domain);
            break;
          case "propagation":
            result = await checkPropagation(
              domain,
              recordTypes?.[0] || "A"
            );
            break;
          default:
            result = await dnsLookup(domain, recordTypes);
            break;
        }

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "ip_info": {
        const result = await getIpInfo(args?.ip as string);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "ssl_check": {
        const port = (args?.port as number) || 443;
        const result = await checkSsl(args?.host as string, port);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "whois_lookup": {
        const result = await whoisLookup(args?.domain as string);
        // Return parsed data without the full raw WHOIS by default to save tokens
        const { raw, ...summary } = result;
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                { ...summary, rawLength: raw.length },
                null,
                2
              ),
            },
          ],
        };
      }

      case "http_ping": {
        const count = (args?.count as number) || 5;
        const timeoutMs = (args?.timeout_ms as number) || 10000;
        const result = await httpPing(args?.url as string, count, timeoutMs);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error: ${message}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP Network Tools server running on stdio");
}

main().catch(console.error);
