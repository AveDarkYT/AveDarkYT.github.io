const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://darkyt1001:myHIt9ggOFVyD8NR@cluster0.7qqa9yv.mongodb.net/Inventario?retryWrites=true&w=majority";

async function run() {
  console.log("Probando conexión directa a Atlas...");
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  try {
    await client.connect();
    console.log("✅ ¡Conexión exitosa a Atlas!");
    await client.db("admin").command({ ping: 1 });
    console.log("✅ ¡Ping exitoso!");
  } catch (err) {
    console.error("❌ Falló la conexión:", err.message);
  } finally {
    await client.close();
  }
}
run();
