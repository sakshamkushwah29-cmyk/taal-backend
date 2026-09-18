const swaggerJsdoc = require("swagger-jsdoc");
const userSwagger = require("../docs/user.swagger");

const swaggerDefinition = {
    openapi: "3.0.0",
    info: {
        title: "NodeJS Boilerplate API",
        version: "1.0.0",
    },
    servers: [{ url: "http://localhost:8000/api/v1" }, { url: "https://example.com/api/v1" }],
    components: {
        securitySchemes: {
            bearerAuth: {
                type: "http",
                scheme: "bearer",
                bearerFormat: "JWT",
            },
        },
    },
    // security: [{ bearerAuth: [] }],
    tags: [
        { name: "User - Auth", description: "User authentication and management endpoints" },
        { name: "User - Address", description: "User address management endpoints" },
        { name: "User - Tasks", description: "Task management endpoints" },
    ],
};

const options = {
    definition: swaggerDefinition,
    apis: [], // No need if using JSON objects manually
};

const swaggerSpec = {
    ...swaggerDefinition,
    paths: {
        ...userSwagger,
    },
};

module.exports = swaggerSpec;