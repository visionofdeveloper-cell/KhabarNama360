export interface LinkCheckResult {
  url: string;
  status: number;
  ok: boolean;
  type: 'internal' | 'external';
  issue?: '404' | '410' | '500' | 'network_error' | 'rate_limited';
  checkedAt: string;
}

export class BrokenLinkChecker {
  static async checkUrl(url: string, isInternal = true): Promise<LinkCheckResult> {
    const checkedAt = new Date().toISOString();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(url, { method: 'HEAD', signal: controller.signal });
      clearTimeout(timeout);

      const status = res.status;
      let issue: LinkCheckResult['issue'];
      if (status === 404) issue = '404';
      else if (status === 410) issue = '410';
      else if (status >= 500) issue = '500';
      else if (status === 429) issue = 'rate_limited';

      return {
        url,
        status,
        ok: status >= 200 && status < 400,
        type: isInternal ? 'internal' : 'external',
        issue,
        checkedAt,
      };
    } catch {
      return {
        url,
        status: 0,
        ok: false,
        type: isInternal ? 'internal' : 'external',
        issue: 'network_error',
        checkedAt,
      };
    }
  }
}
