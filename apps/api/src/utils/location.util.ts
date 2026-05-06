import axios from 'axios';
import { Request } from 'express';

export async function resolveZipFromRequest(req: Request, defaultZip: string = '75201'): Promise<string> {
  if (!req) return defaultZip;

  try {
    const ip =
      req.headers?.['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      (req as any).ip;

    if (!ip || ip === '::1' || ip === '127.0.0.1') {
      return defaultZip;
    }

    const res = await axios.get(`https://ipapi.co/${ip}/json/`, { timeout: 3000 });
    return res.data?.postal || defaultZip;
  } catch {
    return defaultZip;
  }
}
