import { Router } from "express";
import { editUser, getAllUsers, disableUser } from "../controllers/usersController";
import { verifyJWT } from "../middleware/verifyJWT";

const usersRouter: Router = Router();

usersRouter.get("/users", verifyJWT, getAllUsers);

usersRouter.put("/users/:userId", verifyJWT, editUser);

usersRouter.patch("/users/:userId/disable", verifyJWT, disableUser);

export default usersRouter;
