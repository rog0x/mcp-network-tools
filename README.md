[![MCP Server](https://glama.ai/mcp/servers/rog0x/mcp-network-tools/badges/score.svg)](https://glama.ai/mcp/servers/rog0x/mcp-network-tools)

# mcp-network-tools

Network diagnostics tools for AI agents, exposed via the [Model Context Protocol (MCP)](https://modelcontextprotocol.io).

## Tools

| Tool | Description |
|------|-------------|
| `dns_lookup` | Resolve domains to DNS records (A, AAAA, MX, TXT, NS, CNAME, SOA). Reverse DNS. Propagation check across public DNS servers. |
| `ip_info` | Geolocation and network info for an IP address — country, city, ISP, ASN, coordinates. IPv4 and IPv6. |
| `ssl_check` | Inspect SSL/TLS certificates — validity, issuer, expiry, SANs, certificate chain, cipher, protocol. |
| `whois_lookup` | WHOIS data for a domain — registrar, creation/expiry dates, nameservers, status. |
| `http_ping` | Measure HTTP response time over N requests. Returns avg, min, max, p95 latency and success rate. |

## Setup

```bash
npm install
npm run build
```

## Usage with Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "network-tools": {
      "command": "node",
      "args": ["D:/products/mcp-servers/mcp-network-tools/dist/index.js"]
    }
  }
}
```

## Dependencies

- **@modelcontextprotocol/sdk** — MCP server framework
- **Node.js built-in modules** — `dns`, `tls`, `net`, `https`, `http` (no external runtime dependencies beyond MCP SDK)
- **ip-api.com** — free geolocation API (no API key required)

## Examples

### DNS Lookup
```
dns_lookup({ domain: "example.com", record_types: ["A", "MX"] })
```

### Reverse DNS
```
dns_lookup({ domain: "8.8.8.8", mode: "reverse" })
```

### DNS Propagation Check
```
dns_lookup({ domain: "example.com", mode: "propagation" })
```

### IP Info
```
ip_info({ ip: "1.1.1.1" })
```

### SSL Check
```
ssl_check({ host: "example.com" })
```

### WHOIS Lookup
```
whois_lookup({ domain: "example.com" })
```

### HTTP Ping
```
http_ping({ url: "https://example.com", count: 10 })
```

## License

MIT
