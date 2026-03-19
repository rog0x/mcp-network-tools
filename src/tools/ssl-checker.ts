import * as tls from "node:tls";
import * as net from "node:net";

interface CertificateInfo {
  host: string;
  valid: boolean;
  issuer: Record<string, string>;
  subject: Record<string, string>;
  validFrom: string;
  validTo: string;
  daysUntilExpiry: number;
  serialNumber: string;
  fingerprint: string;
  fingerprint256: string;
  subjectAltNames: string[];
  protocol: string;
  cipher: string;
  chain: Array<{
    subject: string;
    issuer: string;
    validTo: string;
  }>;
  timestamp: string;
}

export function checkSsl(
  host: string,
  port: number = 443
): Promise<CertificateInfo> {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(
      {
        host,
        port,
        servername: host,
        rejectUnauthorized: false,
        timeout: 10000,
      },
      () => {
        const cert = socket.getPeerCertificate(true);
        const cipher = socket.getCipher();
        const protocol = socket.getProtocol();
        const authorized = socket.authorized;

        if (!cert || !cert.subject) {
          socket.destroy();
          reject(new Error("No certificate returned by server"));
          return;
        }

        const validTo = new Date(cert.valid_to);
        const now = new Date();
        const daysUntilExpiry = Math.floor(
          (validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        const altNames = cert.subjectaltname
          ? cert.subjectaltname.split(", ").map((s: string) => s.replace("DNS:", ""))
          : [];

        const chain: Array<{ subject: string; issuer: string; validTo: string }> =
          [];
        let current = cert;
        const seen = new Set<string>();
        while (current && current.issuerCertificate && !seen.has(current.fingerprint256)) {
          seen.add(current.fingerprint256);
          const issuerCert = current.issuerCertificate;
          const subjectCN = issuerCert.subject?.CN;
          const issuerCN = issuerCert.issuer?.CN;
          chain.push({
            subject: (Array.isArray(subjectCN) ? subjectCN[0] : subjectCN) || "Unknown",
            issuer: (Array.isArray(issuerCN) ? issuerCN[0] : issuerCN) || "Unknown",
            validTo: issuerCert.valid_to,
          });
          if (issuerCert.fingerprint256 === current.fingerprint256) break;
          current = issuerCert;
        }

        const result: CertificateInfo = {
          host,
          valid: authorized && daysUntilExpiry > 0,
          issuer: cert.issuer as unknown as Record<string, string>,
          subject: cert.subject as unknown as Record<string, string>,
          validFrom: cert.valid_from,
          validTo: cert.valid_to,
          daysUntilExpiry,
          serialNumber: cert.serialNumber,
          fingerprint: cert.fingerprint,
          fingerprint256: cert.fingerprint256,
          subjectAltNames: altNames,
          protocol: protocol || "unknown",
          cipher: cipher?.name || "unknown",
          chain,
          timestamp: new Date().toISOString(),
        };

        socket.destroy();
        resolve(result);
      }
    );

    socket.on("error", (err) => {
      socket.destroy();
      reject(err);
    });

    socket.on("timeout", () => {
      socket.destroy();
      reject(new Error("Connection timed out"));
    });
  });
}
