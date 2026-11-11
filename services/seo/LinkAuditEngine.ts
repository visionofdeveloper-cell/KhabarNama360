import { BrokenLinkChecker, LinkCheckResult } from './BrokenLinkChecker.ts';

export interface LinkAuditReport {
  totalUrlsDiscovered: number;
  urlsChecked: number;
  workingLinks: number;
  brokenLinks: number;
  redirects: number;
  temporaryFailures: number;
  automaticallyRepaired: number;
  issuesRequiringReview: LinkCheckResult[];
  lastRunAt: string;
}

export class LinkAuditEngine {
  static async runAudit(baseUrl: string, paths: string[]): Promise<LinkAuditReport> {
    const results: LinkCheckResult[] = [];
    for (const p of paths) {
      const fullUrl = p.startsWith('http') ? p : `${baseUrl}${p.startsWith('/') ? p : `/${p}`}`;
      const res = await BrokenLinkChecker.checkUrl(fullUrl, !p.startsWith('http'));
      results.push(res);
    }

    const workingLinks = results.filter((r) => r.ok).length;
    const broken = results.filter((r) => !r.ok && r.issue !== 'rate_limited' && r.issue !== 'network_error');
    const temporaryFailures = results.filter((r) => r.issue === 'rate_limited' || r.issue === 'network_error').length;

    return {
      totalUrlsDiscovered: paths.length,
      urlsChecked: results.length,
      workingLinks,
      brokenLinks: broken.length,
      redirects: results.filter((r) => r.status >= 300 && r.status < 400).length,
      temporaryFailures,
      automaticallyRepaired: 0,
      issuesRequiringReview: [...broken, ...results.filter((r) => r.issue === 'network_error')],
      lastRunAt: new Date().toISOString(),
    };
  }
}
