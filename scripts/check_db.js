import { sql } from './shared/src/clients.js';
async function main() {
  try {
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    console.log('Tables in DB:');
    tables.forEach(t => console.log(t.table_name));

    const checkTenants = await sql`SELECT COUNT(*) FROM tenants`.catch(() => [{count: 'no table'}]);
    const checkMerchants = await sql`SELECT COUNT(*) FROM merchants`.catch(() => [{count: 'no table'}]);
    
    console.log('Tenants count:', checkTenants);
    console.log('Merchants count:', checkMerchants);

    const checkIntegrations = await sql`SELECT COUNT(*) FROM merchant_integrations`.catch(() => [{count: 'no table'}]);
    console.log('Integrations count:', checkIntegrations);

    const checkServices = await sql`SELECT COUNT(*) FROM services`.catch(() => [{count: 'no table'}]);
    console.log('Services count:', checkServices);
  } catch (e) {
    console.error('Error:', e);
  } finally {
    process.exit(0);
  }
}
main();
