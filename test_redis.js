const Redis = require('ioredis');
const client = new Redis();
async function test() {
  const pipeline = client.pipeline();
  pipeline.set('testkey', '1');
  console.log("executing pipeline");
  await pipeline.exec();
  console.log("pipeline done");
  client.quit();
}
test();
