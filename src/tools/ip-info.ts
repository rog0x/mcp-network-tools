import http from "node:http";

interface IpInfoResult {
  ip: string;
  country: string;
  countryCode: string;
  region: string;
  regionName: string;
  city: string;
  zip: string;
  lat: number;
  lon: number;
  timezone: string;
  isp: string;
  org: string;
  as: string;
  asn: string;
  query: string;
  timestamp: string;
}

function httpGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: 10000 }, (res) => {
      let data = "";
      res.on("data", (chunk: Buffer) => {
        data += chunk.toString();
      });
      res.on("end", () => resolve(data));
      res.on("error", reject);
    });
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timed out"));
    });
  });
}

export async function getIpInfo(ip: string): Promise<IpInfoResult> {
  const url = `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query`;

  const raw = await httpGet(url);
  const data = JSON.parse(raw);

  if (data.status === "fail") {
    throw new Error(`IP lookup failed: ${data.message}`);
  }

  const asString = (data.as as string) || "";
  const asnMatch = asString.match(/^AS(\d+)/);

  return {
    ip,
    country: data.country ?? "",
    countryCode: data.countryCode ?? "",
    region: data.region ?? "",
    regionName: data.regionName ?? "",
    city: data.city ?? "",
    zip: data.zip ?? "",
    lat: data.lat ?? 0,
    lon: data.lon ?? 0,
    timezone: data.timezone ?? "",
    isp: data.isp ?? "",
    org: data.org ?? "",
    as: asString,
    asn: asnMatch ? `AS${asnMatch[1]}` : "",
    query: data.query ?? ip,
    timestamp: new Date().toISOString(),
  };
}
