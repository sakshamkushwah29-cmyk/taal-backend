const Joi = require("joi");

// ✅ Create Event Validation
const createEvent = Joi.object({
    title: Joi.string().min(3).max(100).required(),
    slug: Joi.string()
        .pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
        .optional()
        .messages({
            "string.pattern.base": "Slug must be URL-friendly (lowercase, hyphens allowed)"
        }),
    description: Joi.string().required().max(2000),
    venueName: Joi.string().required().max(200),
    address: Joi.object({
        address: Joi.string().required().max(300),
        landmark: Joi.string().required().max(200),
        city: Joi.string().required().max(200),
        state: Joi.string().required().max(200),
        pincode: Joi.string().pattern(/^\d{5,6}$/).required().max(200),
        country: Joi.string().allow(null, ""),
        maplink: Joi.string().uri().allow(null, ""),
        lat: Joi.number().min(-90).max(90).allow(null),
        lng: Joi.number().min(-180).max(180).allow(null)
    }).optional(),
    images: Joi.array().items(Joi.string().uri()).default([]),
    banner: Joi.string().uri().allow(null, ""),
    startDate: Joi.date().required(),
    endDate: Joi.date().required().min(Joi.ref("startDate"))
        .messages({
            "date.min": "End date must be after start date"
        }),
});

const updateEvent = Joi.object({
    eventId: Joi.string().required(),
    title: Joi.string().min(3).max(100).required(),
    slug: Joi.string()
        .pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
        .optional()
        .messages({
            "string.pattern.base": "Slug must be URL-friendly (lowercase, hyphens allowed)"
        }),
    description: Joi.string().required().max(2000),
    venueName: Joi.string().required().max(200),
    address: Joi.object({
        address: Joi.string().required().max(300),
        landmark: Joi.string().required().max(200),
        city: Joi.string().required().max(200),
        state: Joi.string().required().max(200),
        pincode: Joi.string().pattern(/^\d{5,6}$/).required().max(200),
        country: Joi.string().allow(null, ""),
        maplink: Joi.string().uri().allow(null, ""),
        lat: Joi.number().min(-90).max(90).allow(null),
        lng: Joi.number().min(-180).max(180).allow(null)
    }).optional(),
    images: Joi.array().items(Joi.string().uri()).default([]),
    banner: Joi.string().uri().allow(null, ""),
    startDate: Joi.date().required(),
    endDate: Joi.date().required().min(Joi.ref("startDate"))
        .messages({
            "date.min": "End date must be after start date"
        }),
});;

// ✅ Create Event Session Validation (Array only)
const createEventSession = Joi.array().items(
    Joi.object({
        event: Joi.string().required(),
        specialNameOfDay: Joi.string().required(),
        date: Joi.date().required(),
        startTime: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).required(), // HH:mm
        endTime: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).required(),
        pricePerTicket: Joi.number().positive().required(),
        currency: Joi.string().default("INR"),
        totalCapacity: Joi.number().positive().required(),
        remainingCapacity: Joi.number().positive().required(),
        status: Joi.string().valid("scheduled", "cancelled", "completed").default("scheduled")
    })
).min(1).required();

const generateTicketFromAdminSideSchema = Joi.object({
    sessionId: Joi.string().required().messages({
        'string.empty': 'Session ID is required',
        'any.required': 'Session ID is required'
    }),
    eventId: Joi.string().required().messages({
        'string.empty': 'Event ID is required',
        'any.required': 'Event ID is required'
    }),
    quantity: Joi.number().integer().min(1).required().messages({
        'number.base': 'Quantity must be a number',
        'number.integer': 'Quantity must be an integer',
        'number.min': 'Quantity must be at least 1',
        'any.required': 'Quantity is required'
    }),
    isVipTicket: Joi.boolean().optional().default(false).messages({
        'boolean.base': 'isVipTicket must be true or false'
    }),
    isValidForAllDays: Joi.boolean().optional().default(false).messages({
        'boolean.base': 'isValidForAllDays must be true or false'
    }),
    ticketName: Joi.string().required().messages({
        'string.empty': 'Vip Name is required',
        'any.required': 'Vip Name is required'
    })
});


const updateEventSession = Joi.object({
    sessionId: Joi.string().required(),
    event: Joi.string().optional(),
    specialNameOfDay: Joi.string().optional(),
    date: Joi.date().optional(),
    startTime: Joi.string()
        .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/) // ✅ HH:mm format
        .optional(),
    endTime: Joi.string()
        .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/) // ✅ HH:mm format
        .optional(),
    pricePerTicket: Joi.number().positive().optional(),
    currency: Joi.string().default("INR").optional(),
    totalCapacity: Joi.number().positive().optional(),
    remainingCapacity: Joi.number().positive().optional(),
    status: Joi.string()
        .valid("scheduled", "cancelled", "completed")
        .default("scheduled")
        .optional(),
});


const eventValidation = {
    createEvent,
    updateEvent,
    createEventSession,
    generateTicketFromAdminSideSchema,
    updateEventSession
};

module.exports = eventValidation;
