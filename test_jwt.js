const { JwtService } = require('@nestjs/jwt');
const jwt = new JwtService({ secret: 'test' });
async function run() {
  console.log("verifying...");
  try {
    await jwt.verifyAsync("invalid.refresh.token");
  } catch (e) {
    console.log("caught", e.message);
  }
  console.log("done");
}
run();
