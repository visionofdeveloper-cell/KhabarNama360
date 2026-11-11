/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 360Khabarnama — SEO-Friendly Slug Generator with Collision Detection
 */

export class SlugGenerator {
  public static generate(title: string, existingSlugs: string[] = []): string {
    const base = title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/(^-|-$)+/g, '')
      .slice(0, 80) || `story-${Date.now()}`;

    if (!existingSlugs.includes(base)) {
      return base;
    }

    let counter = 2;
    while (existingSlugs.includes(`${base}-${counter}`)) {
      counter++;
    }
    return `${base}-${counter}`;
  }
}
