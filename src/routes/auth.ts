import { Router } from "express";
import {
  handleLogout,
  handlePersistentLogin,
  handleRefreshToken,
  loginUser,
  addUser,
  resetPassword,
  adminResetPassword,
} from "../controllers/authController";
import { verifyJWT } from "../middleware/verifyJWT";

const authRouter = Router();

authRouter.post("/auth/user", addUser);

authRouter.post("/auth/login", loginUser);
authRouter.get("/auth/refresh", handleRefreshToken);
authRouter.get("/auth/login/persist", handlePersistentLogin);
authRouter.post("/auth/logout", handleLogout);
authRouter.post("/auth/reset", verifyJWT, resetPassword);
authRouter.post("/auth/admin/reset-password", verifyJWT, adminResetPassword);

export default authRouter;
