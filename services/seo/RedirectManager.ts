export interface RedirectRule {
  id: string;
  fromPath: string;
  toPath: string;
  statusCode: 301 | 302;
  createdAt: string;
}

export class RedirectManager {
  private static rules: RedirectRule[] = [
    {
      id: 'redir-home-en',
      fromPath: '/en/index.html',
      toPath: '/en/',
      statusCode: 301,
      createdAt: '2026-11-10T00:00:00.000Z',
    },
    {
      id: 'redir-home-ur',
      fromPath: '/ur/index.html',
      toPath: '/ur/',
      statusCode: 301,
      createdAt: '2026-11-10T00:00:00.000Z',
    },
  ];

  static getRules(): RedirectRule[] {
    return this.rules;
  }

  static addRule(fromPath: string, toPath: string, statusCode: 301 | 302 = 301): RedirectRule {
    const rule: RedirectRule = {
      id: `redir-${Date.now()}`,
      fromPath,
      toPath,
      statusCode,
      createdAt: new Date().toISOString(),
    };
    this.rules.push(rule);
    return rule;
  }

  static deleteRule(id: string): boolean {
    const before = this.rules.length;
    this.rules = this.rules.filter((r) => r.id !== id);
    return this.rules.length < before;
  }
}
