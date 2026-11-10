/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Khabarnama360 — News Verification, Licensing & Risk Routing Engine
 */

export type PublishingMode = 'MODE_A_VERIFIED_DATA' | 'MODE_B_LICENSED_AUTO' | 'MODE_C_HUMAN_REVIEW';

export interface VerificationResult {
  approvedForAutoPublish: boolean;
  mode: PublishingMode;
  flags: string[];
  riskLevel: 'low' | 'medium' | 'high';
}

export class NewsVerificationEngine {
  private static HIGH_RISK_KEYWORDS = [
    'alleged', 'accused', 'scandal', 'arrested', 'corruption',
    'murder', 'attack', 'blast', 'explosion', 'protest', 'clash',
    'unconfirmed', 'rumor', 'disputed', 'fatwa', 'blasphemy'
  ];

  public static verifyItem(params: {
    title: string;
    summary: string;
    autoPublishAllowed: boolean;
    hasAttribution: boolean;
    licenseType: string;
  }): VerificationResult {
    const flags: string[] = [];
    const text = `${params.title} ${params.summary}`.toLowerCase();

    if (!params.hasAttribution) {
      flags.push('Missing required source attribution.');
    }

    if (!params.autoPublishAllowed || params.licenseType === 'restricted') {
      flags.push('Source license does not permit unattended auto-publishing.');
    }

    const matchedRisk = this.HIGH_RISK_KEYWORDS.filter(k => text.includes(k));
    if (matchedRisk.length > 0) {
      flags.push(`Sensitive/disputed claim keywords detected: ${matchedRisk.join(', ')}`);
    }

    if (flags.length > 0) {
      return {
        approvedForAutoPublish: false,
        mode: 'MODE_C_HUMAN_REVIEW',
        flags,
        riskLevel: matchedRisk.length > 0 ? 'high' : 'medium',
      };
    }

    return {
      approvedForAutoPublish: true,
      mode: 'MODE_B_LICENSED_AUTO',
      flags: [],
      riskLevel: 'low',
    };
  }
}
