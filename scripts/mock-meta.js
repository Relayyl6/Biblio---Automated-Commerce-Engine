import Fastify from "fastify";
import cors from "@fastify/cors";

const app = Fastify({ logger: false });

app.register(cors, {
  origin: "*",
});

let clients = [];

app.post("/v21.0/:phone/messages", async (req, reply) => {
  const body = req.body;
  console.log("Meta received:", JSON.stringify(body));
  clients.forEach(client => client.write(`data: ${JSON.stringify(body)}\n\n`));
  return { messaging_product: "whatsapp", contacts: [{ input: "test", wa_id: "test" }], messages: [{ id: "test" }] };
});

app.get("/stream", (req, reply) => {
  reply.raw.setHeader("Content-Type", "text/event-stream");
  reply.raw.setHeader("Cache-Control", "no-cache");
  reply.raw.setHeader("Access-Control-Allow-Origin", "*");
  reply.raw.flushHeaders();
  
  clients.push(reply.raw);
  req.raw.on("close", () => {
    clients = clients.filter(c => c !== reply.raw);
  });
});

app.listen({ port: 3005, host: "0.0.0.0" }).then(() => {
  console.log("Mock Meta Server running on port 3005");
});
