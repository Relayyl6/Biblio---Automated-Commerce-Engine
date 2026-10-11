import('postgres').then(({ default: postgres }) => {
  const sql = postgres(process.env.DATABASE_URL);
  sql`
    INSERT INTO merchants (id, name, phone_number_id) 
    VALUES ('11111111-1111-1111-1111-111111111111', 'Demo Merchant', '12345')
    ON CONFLICT (id) DO NOTHING
  `.then(() => {
    console.log('✅ Demo Merchant seeded');
    return sql.end();
  }).catch(e => {
    console.error(e);
    process.exit(1);
  });
});
