// controllers/search.controller.js
const mongoose = require('mongoose');
const ProductSale = require('../models/ProductSale');
const SearchQuery = require('../models/SearchQuery');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');

const escapeRegExp = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

exports.getSuggestions = catchAsync(async (req, res, next) => {
    const q = (req.query.q || '').trim();
    const limit = Math.min(Number(req.query.limit) || 8, 20);

    // If no q or q too short, return top popular queries + top products
    if (!q || q.length < 2) {
        // top query suggestions
        const topQueries = await SearchQuery.find().sort({ count: -1 }).limit(limit).lean();
        // top products (cheap lightweight pipeline)
        const topProducts = await ProductSale.aggregate([
            { $match: { status: 'active' } },
            { $unwind: '$variants' },
            {
                $addFields: {
                    effectivePrice: {
                        $cond: [
                            { $and: [{ $ne: ['$variants.discountPrice', null] }, { $gt: ['$variants.discountPrice', 0] }] },
                            '$variants.discountPrice',
                            '$variants.price'
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: '$_id',
                    title: { $first: '$title' },
                    productId: { $first: '$_id' },
                    thumbnail: { $first: { $arrayElemAt: ['$variants.images', 0] } },
                    minPrice: { $min: '$effectivePrice' }
                }
            },
            { $sort: { minPrice: 1 } },
            { $limit: limit }
        ]);

        return res.json({
            suggestions: [
                ...topQueries.map(t => ({ type: 'query', value: t.query, count: t.count })),
                ...topProducts.map(p => ({ type: 'product', value: p.title, productId: p.productId, thumbnail: p.thumbnail }))
            ]
        });
    }

    // When q present: prefix + token matching
    const regexPrefix = new RegExp('^' + escapeRegExp(q), 'i'); // prefix match
    const regexAnywhere = new RegExp(escapeRegExp(q), 'i');     // anywhere match

    // 1) Query suggestions (popular queries that start with prefix)
    const querySuggests = await SearchQuery.find({ query: { $regex: regexPrefix } })
        .sort({ count: -1 })
        .limit(limit)
        .lean();

    // 2) Product title / variant attribute suggestions (aggregate)
    const prodPipeline = [
        { $match: { status: 'active' } },
        { $unwind: '$variants' },
        // compute effective price for better ranking
        {
            $addFields: {
                effectivePrice: {
                    $cond: [
                        { $and: [{ $ne: ['$variants.discountPrice', null] }, { $gt: ['$variants.discountPrice', 0] }] },
                        '$variants.discountPrice',
                        '$variants.price'
                    ]
                }
            }
        },
        // match across product title & variant attributes
        {
            $match: {
                $or: [
                    { title: { $regex: regexPrefix } },               // title prefix
                    { 'variants.color': { $regex: regexPrefix } },    // color prefix
                    { 'variants.size': { $regex: regexPrefix } },     // size prefix (if search 'L')
                    { 'variants.sku': { $regex: regexAnywhere } },    // sku anywhere
                    { tags: { $regex: regexAnywhere } },              // tags anywhere
                    { title: { $regex: regexAnywhere } }              // fallback anywhere
                ]
            }
        },
        {
            $group: {
                _id: '$_id',
                title: { $first: '$title' },
                productId: { $first: '$_id' },
                thumbnail: { $first: { $arrayElemAt: ['$variants.images', 0] } },
                minPrice: { $min: '$effectivePrice' },
                matchScore: { $sum: 1 } // crude score: more matching variants -> higher
            }
        },
        { $sort: { matchScore: -1, minPrice: 1 } },
        { $limit: limit }
    ];

    const productSuggests = await ProductSale.aggregate(prodPipeline);

    // 3) Attribute suggestions (colors)
    const colorPipeline = [
        { $match: { status: 'active' } },
        { $unwind: '$variants' },
        { $match: { 'variants.color': { $regex: new RegExp('^' + escapeRegExp(q), 'i') } } },
        { $group: { _id: { $toLower: '$variants.color' }, color: { $first: '$variants.color' }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 6 }
    ];
    let colorSuggests = [];
    try {
        colorSuggests = await ProductSale.aggregate(colorPipeline);
        colorSuggests = colorSuggests.map(c => ({ type: 'attribute', attribute: 'color', value: c.color }));
    } catch (e) {
        colorSuggests = [];
    }

    // Combine and dedupe: prioritize querySuggests -> productSuggests -> attribute
    const suggestions = [
        ...querySuggests.map(qs => ({ type: 'query', value: qs.query, count: qs.count })),
        ...productSuggests.map(p => ({ type: 'product', value: p.title, productId: p.productId, thumbnail: p.thumbnail })),
        ...colorSuggests
    ].slice(0, limit);

    return res.json({ suggestions });
});

/**
 * Call this when user actually executes search or clicks a suggestion.
 * - For search submit: increment impressions (count)
 * - For suggestion click: increment clicks
 *
 * Example:
 *  POST /search/record?action=impression&query=red%20chaniya
 *  POST /search/record?action=click&query=red%20chaniya
 */
exports.recordSearchAction = catchAsync(async (req, res) => {
    const { action = 'impression' } = req.query;
    const q = (req.body.query || req.query.query || '').trim();
    if (!q) return res.status(200).json({ ok: true });

    const update = { $set: { lastSearchedAt: new Date() } };
    if (action === 'click') update.$inc = { clicks: 1 };
    else update.$inc = { count: 1 };

    await SearchQuery.findOneAndUpdate(
        { query: q.toLowerCase() },
        update,
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({ ok: true });
});


// routes/search.routes.js
const router = require('express').Router();
const { getSuggestions, recordSearchAction } = require('../controllers/search.controller');

router.get('/suggestions', getSuggestions);
router.post('/record', recordSearchAction);

module.exports = router;
