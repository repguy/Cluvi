import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import botsRouter from "./bots";
import widgetRouter from "./widget";
import analyticsRouter from "./analytics";
import bookingsRouter from "./bookings";
import conversationsRouter from "./conversations";
import adminRouter from "./admin";
import leadsRouter from "./leads";
import reportsRouter from "./reports";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(botsRouter);
router.use(widgetRouter);
router.use(analyticsRouter);
router.use(bookingsRouter);
router.use(conversationsRouter);
router.use(adminRouter);
router.use(leadsRouter);
router.use(reportsRouter);

export default router;
