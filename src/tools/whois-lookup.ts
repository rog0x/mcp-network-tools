import * as net from "node:net";

interface WhoisResult {
  domain: string;
  raw: string;
  parsed: {
    registrar: string;
    creationDate: string;
    expiryDate: string;
    updatedDate: string;
    nameServers: string[];
    status: string[];
    registrant: string;
  };
  timestamp: string;
}

function queryWhoisServer(server: string, query: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let data = "";

    socket.setTimeout(10000);

    socket.connect(43, server, () => {
      socket.write(query + "\r\n");
    });

    socket.on("data", (chunk: Buffer) => {
      data += chunk.toString();
    });

    socket.on("end", () => {
      resolve(data);
    });

    socket.on("timeout", () => {
      socket.destroy();
      reject(new Error(`WHOIS query to ${server} timed out`));
    });

    socket.on("error", (err) => {
      reject(err);
    });
  });
}

function extractField(raw: string, patterns: string[]): string {
  for (const pattern of patterns) {
    const regex = new RegExp(`${pattern}:\\s*(.+)`, "im");
    const match = raw.match(regex);
    if (match) return match[1].trim();
  }
  return "";
}

function extractMulti(raw: string, patterns: string[]): string[] {
  const results: string[] = [];
  for (const pattern of patterns) {
    const regex = new RegExp(`${pattern}:\\s*(.+)`, "gim");
    let match: RegExpExecArray | null;
    while ((match = regex.exec(raw)) !== null) {
      const value = match[1].trim();
      if (value && !results.includes(value)) {
        results.push(value);
      }
    }
  }
  return results;
}

function getWhoisServer(tld: string): string {
  const servers: Record<string, string> = {
    com: "whois.verisign-grs.com",
    net: "whois.verisign-grs.com",
    org: "whois.pir.org",
    info: "whois.afilias.net",
    io: "whois.nic.io",
    dev: "whois.nic.google",
    app: "whois.nic.google",
    co: "whois.nic.co",
    me: "whois.nic.me",
    ai: "whois.nic.ai",
    xyz: "whois.nic.xyz",
    tech: "whois.nic.tech",
  };
  return servers[tld] || "whois.iana.org";
}

export async function whoisLookup(domain: string): Promise<WhoisResult> {
  const parts = domain.split(".");
  const tld = parts[parts.length - 1].toLowerCase();

  const server = getWhoisServer(tld);
  let raw = await queryWhoisServer(server, domain);

  // Check for referral to another WHOIS server
  const referralMatch = raw.match(/Whois Server:\s*(.+)/im);
  if (referralMatch) {
    const referralServer = referralMatch[1].trim();
    if (referralServer !== server) {
      try {
        const referralData = await queryWhoisServer(referralServer, domain);
        if (referralData.length > raw.length) {
          raw = referralData;
        }
      } catch {
        // Use original data if referral fails
      }
    }
  }

  const parsed = {
    registrar: extractField(raw, ["Registrar", "Sponsoring Registrar"]),
    creationDate: extractField(raw, [
      "Creation Date",
      "Created Date",
      "Created",
      "Registration Date",
    ]),
    expiryDate: extractField(raw, [
      "Registry Expiry Date",
      "Registrar Registration Expiration Date",
      "Expiry Date",
      "Expiration Date",
    ]),
    updatedDate: extractField(raw, [
      "Updated Date",
      "Last Updated",
      "Last Modified",
    ]),
    nameServers: extractMulti(raw, ["Name Server", "Nameserver", "nserver"]),
    status: extractMulti(raw, ["Domain Status", "Status"]),
    registrant: extractField(raw, [
      "Registrant Organization",
      "Registrant Name",
      "Registrant",
    ]),
  };

  return {
    domain,
    raw,
    parsed,
    timestamp: new Date().toISOString(),
  };
}
