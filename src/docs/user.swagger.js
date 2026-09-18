module.exports = {
    "/user/create-user": {
        post: {
            summary: "Create a new user",
            description: "This endpoint creates a new user with name, email, and password.",
            tags: ["User - Auth"],
            requestBody: {
                required: true,
                content: {
                    "application/json": {
                        schema: {
                            type: "object",
                            required: ["name", "email", "password"],
                            properties: {
                                name: { type: "string", example: "John Doe" },
                                email: { type: "string", example: "john@example.com" },
                                password: { type: "string", example: "StrongP@ss123" },
                            },
                        },
                    },
                },
            },
            responses: {
                201: {
                    description: "User created successfully",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    success: { type: "boolean", example: true },
                                    message: { type: "string", example: "User created successfully" },
                                    data: {
                                        type: "object",
                                        properties: {
                                            _id: { type: "string", example: "64dfb93230a8df4a1c4a2e7b" },
                                            name: { type: "string", example: "John Doe" },
                                            email: { type: "string", example: "john@example.com" },
                                            createdAt: {
                                                type: "string",
                                                format: "date-time",
                                                example: "2024-09-25T05:57:06.676Z",
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                400: {
                    description: "Missing required fields",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    error: {
                                        type: "string",
                                        example: "Name, email, and password are required.",
                                    },
                                },
                            },
                        },
                    },
                },
                409: {
                    description: "Email already exists",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    error: { type: "string", example: "Email already exists." },
                                },
                            },
                        },
                    },
                },
            },
        },
    },
    "/user/login-user": {
        post: {
            summary: "Login user and get JWT token",
            tags: ["User - Auth"],
            requestBody: {
                required: true,
                content: {
                    "application/json": {
                        schema: {
                            type: "object",
                            required: ["email", "password"],
                            properties: {
                                email: { type: "string", example: "chetan@yopmail.com" },
                                password: { type: "string", example: "Admin123#" },
                            },
                        },
                    },
                },
            },
            responses: {
                200: {
                    description: "Login successful",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    success: { type: "boolean", example: true },
                                    message: { type: "string", example: "Login successful" },
                                    data: {
                                        type: "object",
                                        properties: {
                                            token: { type: "string", example: "eyJhbGciOiJIUzI1NiIsInR..." },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                400: {
                    description: "Missing email or password",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    success: { type: "boolean", example: false },
                                    statusCode: { type: "integer", example: 400 },
                                    message: { type: "string", example: "Missing email or password" }
                                }
                            }
                        }
                    }
                },
                401: {
                    description: "Invalid credentials",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    success: { type: "boolean", example: false },
                                    statusCode: { type: "integer", example: 401 },
                                    message: { type: "string", example: "Invalid email or password" }
                                }
                            }
                        }
                    }
                },
                500: {
                    description: "Internal Server Error",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    success: { type: "boolean", example: false },
                                    statusCode: { type: "integer", example: 500 },
                                    message: { type: "string", example: "Internal Server Error" },
                                    stack: { type: "string", example: "ReferenceError: bcrypt is not defined..." }
                                }
                            }
                        }
                    }
                }
            },
        },
    },
    "/user/get-all-users": {
        get: {
            summary: "Get all users with addresses",
            description: "Returns a paginated list of all users along with their addresses.",
            tags: ["User - Auth"],
            parameters: [
                {
                    name: "page",
                    in: "query",
                    schema: { type: "integer", default: 1 },
                    description: "Page number for pagination",
                    required: false,
                },
                {
                    name: "limit",
                    in: "query",
                    schema: { type: "integer", default: 10 },
                    description: "Number of users per page",
                    required: false,
                },
            ],
            responses: {
                200: {
                    description: "Users fetched successfully",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    success: { type: "boolean", example: true },
                                    message: { type: "string", example: "Users fetched" },
                                    data: {
                                        type: "array",
                                        items: {
                                            type: "object",
                                            properties: {
                                                _id: { type: "string", example: "64dfb93230a8df4a1c4a2e7b" },
                                                name: { type: "string", example: "John Doe" },
                                                email: { type: "string", example: "john@example.com" },
                                                createdAt: {
                                                    type: "string",
                                                    format: "date-time",
                                                    example: "2024-09-25T05:57:06.676Z",
                                                },
                                                addresses: {
                                                    type: "array",
                                                    items: {
                                                        type: "object",
                                                        properties: {
                                                            street: { type: "string", example: "123 Main St" },
                                                            city: { type: "string", example: "Mumbai" },
                                                            state: { type: "string", example: "Maharashtra" },
                                                            zipCode: { type: "string", example: "400001" },
                                                            country: { type: "string", example: "India" },
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                500: {
                    description: "Internal Server Error",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    success: { type: "boolean", example: false },
                                    statusCode: { type: "integer", example: 500 },
                                    message: { type: "string", example: "Internal Server Error" },
                                    stack: { type: "string", example: "ReferenceError: bcrypt is not defined..." }
                                }
                            }
                        }
                    }
                }
            },
        },
    },
    "/user/get-user-by-id/{id}": {
        get: {
            summary: "Get user by ID",
            tags: ["User - Auth"],
            security: [{ bearerAuth: [] }],
            parameters: [
                {
                    name: "id",
                    in: "path",
                    required: true,
                    schema: { type: "string" },
                    description: "User ID",
                },
            ],
            responses: {
                200: {
                    description: "User fetched successfully",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    success: { type: "boolean", example: true },
                                    message: { type: "string", example: "User fetched" },
                                    data: {
                                        type: "object",
                                        properties: {
                                            _id: { type: "string" },
                                            name: { type: "string" },
                                            email: { type: "string" },
                                            addresses: {
                                                type: "array",
                                                items: {
                                                    type: "object",
                                                    properties: {
                                                        street: { type: "string" },
                                                        city: { type: "string" },
                                                        state: { type: "string" },
                                                        zipCode: { type: "string" },
                                                        country: { type: "string" },
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                400: {
                    description: "Invalid user ID",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    success: { type: "boolean", example: false },
                                    statusCode: { type: "integer", example: 400 },
                                    message: { type: "string", example: "Invalid user ID" }
                                }
                            }
                        }
                    }
                },
                401: {
                    description: "Unauthorized - token missing or invalid",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    success: { type: "boolean", example: false },
                                    statusCode: { type: "integer", example: 401 },
                                    message: {
                                        type: "string",
                                        example: "Unauthorized - token missing or invalid"
                                    }
                                }
                            }
                        }
                    }
                },
                404: {
                    description: "User not found",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    success: { type: "boolean", example: false },
                                    statusCode: { type: "integer", example: 404 },
                                    message: { type: "string", example: "User not found" }
                                }
                            }
                        }
                    }
                },
                500: {
                    description: "Internal Server Error",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    success: { type: "boolean", example: false },
                                    statusCode: { type: "integer", example: 500 },
                                    message: { type: "string", example: "Internal Server Error" },
                                    stack: { type: "string", example: "ReferenceError: bcrypt is not defined..." }
                                }
                            }
                        }
                    }
                }
            },
        },
    },

    "/user/create-address": {
        post: {
            summary: "Add address for logged-in user",
            tags: ["User - Address"],
            security: [{ bearerAuth: [] }],
            requestBody: {
                required: true,
                content: {
                    "application/json": {
                        schema: {
                            type: "object",
                            required: ["street", "city", "state", "zipCode", "country"],
                            properties: {
                                street: { type: "string", example: "123 Main St" },
                                city: { type: "string", example: "Mumbai" },
                                state: { type: "string", example: "Maharashtra" },
                                zipCode: { type: "string", example: "400001" },
                                country: { type: "string", example: "India" },
                            },
                        },
                    },
                },
            },
            responses: {
                201: {
                    description: "Address added successfully",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    success: { type: "boolean", example: true },
                                    message: { type: "string", example: "Address added" },
                                    data: {
                                        type: "object",
                                        properties: {
                                            _id: { type: "string" },
                                            street: { type: "string" },
                                            city: { type: "string" },
                                            state: { type: "string" },
                                            zipCode: { type: "string" },
                                            country: { type: "string" },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                400: {
                    description: "Missing required address fields",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    success: { type: "boolean", example: false },
                                    statusCode: { type: "integer", example: 400 },
                                    message: {
                                        type: "string",
                                        example: "Missing required address fields"
                                    }
                                }
                            }
                        }
                    }
                },
                401: {
                    description: "Unauthorized - token missing or invalid",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    success: { type: "boolean", example: false },
                                    statusCode: { type: "integer", example: 401 },
                                    message: {
                                        type: "string",
                                        example: "Unauthorized - token missing or invalid"
                                    }
                                }
                            }
                        }
                    }
                },
                500: {
                    description: "Internal Server Error",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    success: { type: "boolean", example: false },
                                    statusCode: { type: "integer", example: 500 },
                                    message: { type: "string", example: "Internal Server Error" },
                                    stack: { type: "string", example: "ReferenceError: bcrypt is not defined..." }
                                }
                            }
                        }
                    }
                }
            },
        },
    },

    "/user/create-task": {
        post: {
            summary: "Create a new task for a user",
            tags: ["User - Tasks"],
            security: [{ bearerAuth: [] }],
            requestBody: {
                required: true,
                content: {
                    "application/json": {
                        schema: {
                            type: "object",
                            required: ["title", "userId"],
                            properties: {
                                title: { type: "string", example: "Finish documentation" },
                                description: { type: "string", example: "Complete the API docs by EOD" },
                                status: {
                                    type: "string",
                                    enum: ["pending", "completed"],
                                    example: "pending"
                                }
                            },
                        },
                    },
                },
            },
            responses: {
                201: {
                    description: "Task created successfully",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    success: { type: "boolean", example: true },
                                    message: { type: "string", example: "Task created successfully" },
                                    data: {
                                        type: "object",
                                        properties: {
                                            _id: { type: "string", example: "64e1a2b5f1a2c3d4e5f67890" },
                                            title: { type: "string", example: "Finish documentation" },
                                            description: { type: "string", example: "Complete the API docs by EOD" },
                                            user: { type: "string", example: "64dfb93230a8df4a1c4a2e7b" },
                                            status: { type: "string", example: "pending" },
                                            createdAt: {
                                                type: "string",
                                                format: "date-time",
                                                example: "2025-07-16T12:34:56.789Z",
                                            },
                                            updatedAt: {
                                                type: "string",
                                                format: "date-time",
                                                example: "2025-07-16T12:34:56.789Z",
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                400: {
                    description: "Missing required fields",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    success: { type: "boolean", example: false },
                                    statusCode: { type: "integer", example: 400 },
                                    message: { type: "string", example: "Title and userId are required" },
                                },
                            },
                        },
                    },
                },
                404: {
                    description: "User not found",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    success: { type: "boolean", example: false },
                                    statusCode: { type: "integer", example: 404 },
                                    message: { type: "string", example: "User not found" },
                                },
                            },
                        },
                    },
                },
                500: {
                    description: "Internal Server Error",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    success: { type: "boolean", example: false },
                                    statusCode: { type: "integer", example: 500 },
                                    message: { type: "string", example: "Internal Server Error" },
                                    stack: { type: "string", example: "Error stack trace here..." },
                                },
                            },
                        },
                    },
                },
            },
        },
    },

};


