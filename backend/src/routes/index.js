import { Router } from "express";
import { authRouter } from "./auth.routes.js";
import { adminRouter } from "./admin.routes.js";
import { deviceRouter } from "./device.routes.js";
import { publicRouter } from "./public.routes.js";
import { userRouter } from "./user.routes.js";

export const apiRouter = Router();
apiRouter.use("/auth", authRouter);
apiRouter.use("/admin", adminRouter);
apiRouter.use("/device", deviceRouter);
apiRouter.use("/public", publicRouter);
apiRouter.use("/user", userRouter);
