const router = require('express').Router();
const { asyncHandler, ok } = require('../utils');
const { validate, limiter } = require('../middleware');
const { z } = require('../validators');
const geo = require('../services/geo.service');

router.use(limiter(60 * 1000, 30, 'Too many address lookups. Please slow down.'));
router.get('/search', validate(z.object({ q: z.string().trim().min(3).max(120) }), 'query'), asyncHandler(async (req, res) => { res.set('Cache-Control', 'public, max-age=300'); ok(res, await geo.search(req.query.q)); }));
router.get('/reverse', validate(z.object({ lat: z.coerce.number().min(-90).max(90), lng: z.coerce.number().min(-180).max(180) }), 'query'), asyncHandler(async (req, res) => ok(res, await geo.reverse(req.query.lat, req.query.lng))));

module.exports = router;
