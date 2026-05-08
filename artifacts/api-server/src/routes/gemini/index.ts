import { Router } from "express";
import conversationsRouter from "./conversations";
import messagesRouter from "./messages";
import imageRouter from "./image";
import modelsRouter from "./models";
import videoRouter from "./video";

const router = Router();

router.use(modelsRouter);
router.use(conversationsRouter);
router.use(messagesRouter);
router.use(imageRouter);
router.use(videoRouter);

export default router;
