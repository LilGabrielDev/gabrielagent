// Test database connection with PrismaNeon adapter
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../src/generated/prisma/client/index.js";

const connectionString = process.env.DATABASE_URL || 
  "postgresql://neondb_owner:npg_xTWDHeuC79bM@ep-wispy-flower-ai8majhp-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

async function main() {
  console.log("Starting DB connection test with PrismaNeon adapter...");
  
  try {
    const adapter = new PrismaNeon({ connectionString });
    console.log("Adapter created successfully");
    
    const prisma = new PrismaClient({ adapter });
    console.log("PrismaClient created");
    
    // Test basic query
    const adminCount = await prisma.admin.count();
    console.log("Admin count:", adminCount);
    
    const channelCount = await prisma.channel.count();
    console.log("Channel count:", channelCount);
    
    // Test channel query
    const channels = await prisma.channel.findMany();
    console.log("Channels:", JSON.stringify(channels));
    
    console.log("SUCCESS - all queries work!");
    
    await prisma.$disconnect();
  } catch (err) {
    console.error("ERROR:", err.message);
    if (err.meta) console.error("META:", JSON.stringify(err.meta));
    if (err.code) console.error("CODE:", err.code);
  }
}

main().catch(err => {
  console.error("FATAL:", err.message);
  process.exit(1);
});
