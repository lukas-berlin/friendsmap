const { Router } = require("express");

const validator = require("./validator");
const controller = require("./controller");
const tryCatch = require("./try-catch");

const router = new Router();

router.get("/", controller.getLocations);

router.post("/", validator.storeLocation, tryCatch(controller.storeLocation));

module.exports = router;
