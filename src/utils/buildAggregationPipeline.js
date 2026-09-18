// utils/buildAggregationPipeline.js

module.exports = function buildAggregationPipeline(stages = {}) {
    const {
        match,
        lookups = [],
        addFields,
        group,
        unwind,
        project,
        sort,
        skip = 0,
        limit = 10,
    } = stages;

    const pipeline = [];

    if (match && typeof match === 'object') pipeline.push({ $match: match });

    if (lookups && Array.isArray(lookups)) {
        for (const lookup of lookups) {
            if (lookup.pipeline) {
                pipeline.push({ $lookup: { from: lookup.from, pipeline: lookup.pipeline, as: lookup.as } });
            } else {
                pipeline.push({ $lookup: lookup });
            }
        }
    }

    if (unwind) {
        if (Array.isArray(unwind)) {
            unwind.forEach(u => pipeline.push({ $unwind: u }));
        } else {
            pipeline.push({ $unwind: unwind });
        }
    }

    if (addFields) {
        if (Array.isArray(addFields)) {
            addFields.forEach(af => pipeline.push({ $addFields: af }));
        } else {
            pipeline.push({ $addFields: addFields });
        }
    }

    if (group) {
        if (Array.isArray(group)) {
            group.forEach(g => pipeline.push({ $group: g }));
        } else {
            pipeline.push({ $group: group });
        }
    }

    if (project && typeof project === 'object') pipeline.push({ $project: project });
    if (sort && typeof sort === 'object') pipeline.push({ $sort: sort });
    if (skip !== undefined) pipeline.push({ $skip: Number(skip) });
    if (limit !== undefined) pipeline.push({ $limit: Number(limit) });

    return pipeline;
};

