import { Router } from "express";
import conversationsRouter from "./conversations";
import messagesRouter from "./messages";
import imageRouter from "./image";
import modelsRouter from "./models";

const router = Router();

router.use(modelsRouter);
router.use(conversationsRouter);
router.use(messagesRouter);
router.use(imageRouter);

export default router;
