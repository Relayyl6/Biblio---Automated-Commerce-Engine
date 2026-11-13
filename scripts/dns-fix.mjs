/**
 * scripts/dns-fix.mjs
 *
 * DNS preload module — imported via NODE_OPTIONS="--import .../dns-fix.mjs"
 * in every child microservice process.
 *
 * Fixes: getaddrinfo EAI_AGAIN / ENOTFOUND ep-fragrant-cake-axw2ieex-pooler.c-4.us-east-2.aws.neon.tech
 * Root cause: Windows WSL bridge DNS (172.x.x.x) intermittently fails to resolve
 *             external hostnames. Google DNS (8.8.8.8) resolves them reliably.
 */

import dns from 'dns';

dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
