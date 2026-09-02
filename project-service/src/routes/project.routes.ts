import { Router } from "express";
import {
	createProjectController,
	launchProjectController
} from "../controller/project.controller.js"
import { authenticate } from "../middleware/auth.middleware.js"

const projectRouter = Router()

projectRouter.use(authenticate)
projectRouter.post('/', createProjectController)
projectRouter.post('/:projectId/launch', launchProjectController)

export default projectRouter