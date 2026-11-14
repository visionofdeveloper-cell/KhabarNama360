/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — Automated Feed Data Validator (Schema, Range & Anomaly Checks)
 */

export interface ValidationOutcome {
  passed: boolean;
  warnings: string[];
  errors: string[];
}

export class DataValidator {
  public static validatePayload(category: string, payload: any): ValidationOutcome {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (payload === null || payload === undefined) {
      errors.push('Response payload is empty or null.');
      return { passed: false, warnings, errors };
    }

    if (category === 'currency' && payload?.rates) {
      const pkr = Number(payload.rates.PKR);
      if (!pkr || Number.isNaN(pkr) || pkr < 120 || pkr > 600) {
        errors.push(`USD/PKR rate out of reasonable bounds: ${payload.rates.PKR}`);
      }
    }

    if (category === 'weather' && payload?.current) {
      const temp = Number(payload.current.temperature_2m);
      if (Number.isNaN(temp) || temp < -25 || temp > 58) {
        errors.push(`Temperature reading out of valid meteorological range (-25..58 C): ${temp}`);
      }
    }

    if (category === 'gold' && Array.isArray(payload)) {
      const rate24k = payload[0]?.tolaPkr;
      if (!rate24k || rate24k < 50000 || rate24k > 1000000) {
        errors.push(`Gold 24K per tola price out of valid range: ${rate24k}`);
      }
    }

    if (typeof payload === 'object' && Object.keys(payload).length === 0) {
      warnings.push('Received empty JSON object from upstream source.');
    }

    return {
      passed: errors.length === 0,
      warnings,
      errors,
    };
  }
}
