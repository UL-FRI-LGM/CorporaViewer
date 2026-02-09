import {Router} from 'express';
import poslanciController from "../controllers/poslanciController";
import krajevnaImenaController from "../controllers/krajevnaImenaController";
import pdfController from "../controllers/pdfController";
import meetingsController from "../controllers/meetingsController";
import headers from "../middleware/headers"

const router: Router = Router();

router.get("/poslanci/getAll", poslanciController.getAll);

router.get("/krajevnaImena/getAll", krajevnaImenaController.getAll);

router.get("/pdf/getById/:id", pdfController.getById);
router.get("/pdf/getThumbnailById/:id", pdfController.getThumbnailById);

router.get("/meetings/getPage/:page", meetingsController.getPage);
router.get("/meetings/:meetingId/getMeetingAsText", meetingsController.getMeetingAsText);
router.get("/meetings/:meetingId/getSpeakers", meetingsController.getSpeakers);
router.get("/meetings/:meetingId/getHighlights", headers.setHtmlChunkedHeaders, meetingsController.getHighlights);

export default router;
