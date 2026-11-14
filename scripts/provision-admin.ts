#!/usr/bin/env tsx
/**
 * 360Khabarnama CLI — Admin Account Provisioning & Password Reset
 * Usage: npx tsx scripts/provision-admin.ts <email> <password> [nameEn]
 */

import { provisionFirstAdmin, isBootstrapRequired, setStaffPasswordCredential } from '../src/server/auth.ts';

const [, , email, password, nameEn = 'Chief Administrator'] = process.argv;

if (!email || !password) {
  console.error('Usage: npx tsx scripts/provision-admin.ts <email> <password> [nameEn]');
  process.exit(1);
}

if (isBootstrapRequired()) {
  const res = provisionFirstAdmin(email, password, nameEn);
  if (!res.success) {
    console.error('Bootstrap error:', res.error);
    process.exit(1);
  }
  console.log(`Provisioned initial Super Admin: ${email}`);
} else {
  const res = setStaffPasswordCredential(email, password, undefined, 'CLI Provisioner');
  if (!res.success) {
    console.error('Credential update error:', res.error);
    process.exit(1);
  }
  console.log(`Updated credentials for admin user: ${email}`);
}
