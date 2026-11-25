const express = require("express");
const router = express.Router();
const { getLiveReelStock, getStockRegisterOverview } = require("../controllers/inventory.controller");
const { protect } = require("../middlewares/auth.middleware");
const { getPhysicalReels } = require("../controllers/inventory.controller");

router.use(protect);
router.use((req, res, next) => { req.companyKey = 'sk-packaging'; next(); });
router.get("/register", getStockRegisterOverview);
router.get("/reels", getLiveReelStock);
router.get("/reels/physical", getPhysicalReels);

module.exports = router;
