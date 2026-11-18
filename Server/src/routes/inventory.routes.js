const express = require("express");
const router = express.Router();
const { getLiveReelStock } = require("../controllers/inventory.controller");
const { protect } = require("../middlewares/auth.middleware");
const { requireRole } = require("../middlewares/role.middleware");
const { getPhysicalReels } = require("../controllers/inventory.controller");

router.use(protect, requireRole('admin'));
router.get("/reels", getLiveReelStock);
router.get("/reels/physical", getPhysicalReels);

module.exports = router;
