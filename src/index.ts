import authRouter from "./routes/auth";
import fileRouter from "./routes/fileRouter";
import uploadRouter from "./routes/uploadRouter";
import usersRouter from "./routes/users";
import vendorRouter from "./routes/vendorRouter";
import { WebServer } from "./webServer";


const port = parseInt(process.env.PORT || '3000', 10)
const allowedOrigins = [
      "http://127.0.0.1:3000",
      "https://rms-drab.vercel.app",
      "https://report.aatcabuja.com.ng",
      "https://www.report.aatcabuja.com.ng",
      "https://rms-production-43b9.up.railway.app/login",
      "http://localhost:3000",
    ]

process.on("uncaughtException", (err) => {
  process.exit(1);
});

const server = new WebServer({
  port,
  allowedOrigins,
}, [
  authRouter,
  usersRouter,
  vendorRouter,
  fileRouter,
  uploadRouter,
]);
server.start();

process.on("unhandledRejection", async (err) => {
  await server.stop();
  process.exit(1);
});

process.on("SIGTERM", () => {
  server.stop();
});