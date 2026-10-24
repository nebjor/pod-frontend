/**
 * Generated from target/openapi.json of the cad-slicer-engine backend by scripts/generate-api-types.mjs.
 * Do not edit by hand; run `npm run api:types` against a running backend instead.
 */
export interface paths {
    "/api/account": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["account"];
        put: operations["update"];
        post?: never;
        delete: operations["deleteAccount"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/account/cart": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["cart"];
        put: operations["replace"];
        post?: never;
        delete: operations["clear"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/account/cart/{id}/model": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["registerModel"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/account/login-links": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["requestLoginLink"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/account/orders": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["orders"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/account/orders/{orderNumber}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["order"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/account/password": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: operations["setPassword"];
        post?: never;
        delete: operations["removePassword"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/account/sessions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["openSession"];
        delete: operations["logout"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/account/sessions/password": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["openSessionWithPassword"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/calibration/queue": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["queue"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/calibration/queue/{modelId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["queueStoredModel"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/calibration/queue/order/{orderNumber}/{position}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["queueOrderItem"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/calibration/report": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["report"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/calibration/rows": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["rows"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/calibration/rows.csv": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["rowsCsv"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/calibration/run-now": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["runNow"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/orders": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["list"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/orders/{orderNumber}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/orders/{orderNumber}/erase": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["erase"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/orders/{orderNumber}/items/{position}/model": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["model"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/orders/{orderNumber}/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["setStatus"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/admin/rate-limits/reset": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["resetRateLimit"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/models": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["upload"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/orders": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["placeOrder"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/orders/settings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["settings"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/payments/mock/{sessionId}/complete": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["complete"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/quotes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["quoteUpload"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/quotes/options": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["options"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        AccountResponse: {
            city: string | null;
            country: string | null;
            /** Format: date-time */
            createdAt: string;
            email: string;
            hasPassword: boolean;
            /** Format: date-time */
            lastLoginAt: string;
            name: string | null;
            postalCode: string | null;
            street: string | null;
        };
        AccountUpdateRequest: {
            city: string;
            country: string;
            name: string;
            postalCode: string;
            street: string;
        };
        AdminOrderItemResponse: {
            color: components["schemas"]["ColorOption"];
            filament: string;
            filamentGrams: number;
            fileName: string;
            fileSha256: string;
            /** Format: int64 */
            fileSizeBytes: number;
            layerHeightMm: number;
            lineTotalChf: number;
            machineProfile: string;
            /** @description Whether the mesh is watertight; null when not checked */
            manifold: boolean | null;
            /** Format: int32 */
            plateCount: number;
            /**
             * Format: int32
             * @description 1-based position on the order
             */
            position: number;
            /** Format: int32 */
            printTimeSeconds: number;
            quality: string;
            /** Format: int32 */
            quantity: number;
            unitPriceChf: number;
            /** @description Slicer warnings about the model, as the slicer printed them */
            warnings: string[];
        };
        AdminOrderResponse: {
            accountEmail: string | null;
            allowedTransitions: ("NEW" | "PAID" | "IN_REVIEW" | "APPROVED" | "PRINTING" | "SHIPPED" | "CANCELLED")[];
            city: string;
            country: string;
            /** Format: date-time */
            createdAt: string;
            customerEmail: string;
            customerName: string;
            /** Format: date-time */
            deleteAfter: string | null;
            /** Format: date-time */
            erasedAt: string | null;
            items: components["schemas"]["AdminOrderItemResponse"][];
            /** @description True when an item carries slicer warnings or is not manifold; open those models before printing */
            needsInspection: boolean;
            orderNumber: string;
            /** Format: date-time */
            paidAt: string | null;
            paymentProvider: string | null;
            postalCode: string;
            /** Format: date-time */
            quoteExpiresAt: string;
            /** Format: date-time */
            shippedAt: string | null;
            /** @enum {string} */
            status: "NEW" | "PAID" | "IN_REVIEW" | "APPROVED" | "PRINTING" | "SHIPPED" | "CANCELLED";
            street: string;
            totals: components["schemas"]["OrderTotals"];
        };
        ArithmeticError: {
            /** Format: double */
            maxAbsPercent: number | null;
            /** Format: double */
            meanAbsPercent: number | null;
            /** Format: double */
            meanPercent: number | null;
            /** Format: int32 */
            n: number;
        };
        BoundingBox: {
            /** Format: double */
            depthMm: number;
            /** Format: double */
            heightMm: number;
            /** Format: double */
            widthMm: number;
        };
        CalibratedModel: {
            bbox: components["schemas"]["BoundingBox"];
            /** Format: int32 */
            cells: number;
            /** Format: date-time */
            measuredAt: string;
            modelName: string;
            modelSha256: string;
            orderNumber: string | null;
            /** @enum {string} */
            source: "quote" | "order" | "manual";
            /** Format: int32 */
            triangleCount: number;
        };
        CalibrationQueueResponse: {
            /** Format: int32 */
            cellsWritten: number;
            /** @description Why the model yielded no row; null unless the status is failed */
            error: string | null;
            /** Format: date-time */
            finishedAt: string | null;
            /** Format: uuid */
            id: string;
            modelName: string;
            modelSha256: string;
            orderNumber: string | null;
            /** Format: date-time */
            queuedAt: string;
            /** @enum {string} */
            source: "quote" | "order" | "manual";
            /** Format: date-time */
            startedAt: string | null;
            /** @enum {string} */
            status: "queued" | "running" | "done" | "failed";
        };
        CalibrationReport: {
            arithmeticError: {
                [key: string]: components["schemas"]["ArithmeticError"];
            };
            calibratedModels: components["schemas"]["CalibratedModel"][];
            configured: components["schemas"]["Configured"];
            lengthFactor: {
                [key: string]: {
                    [key: string]: components["schemas"]["CalibrationStats"];
                };
            };
            /** Format: int32 */
            models: number;
            quantity: {
                [key: string]: components["schemas"]["QuantityStats"];
            };
            /** Format: int64 */
            rows: number;
            sources: {
                [key: string]: number;
            };
            timeFactor: {
                [key: string]: {
                    [key: string]: components["schemas"]["CalibrationStats"];
                };
            };
        };
        CalibrationStats: {
            /** Format: double */
            max: number | null;
            /** Format: double */
            mean: number | null;
            /** Format: double */
            median: number | null;
            /** Format: double */
            min: number | null;
            /** Format: int32 */
            n: number;
        };
        CartItemRequest: {
            colorId: string;
            filament: string;
            fileName: string;
            /** Format: uuid */
            id?: string | null;
            modelId?: string | null;
            quality: string;
            /** Format: int32 */
            quantity?: number;
            /** @description Opaque quote JSON of the line */
            quote: {
                [key: string]: unknown;
            };
        };
        CartItemResponse: {
            colorId: string;
            filament: string;
            fileName: string;
            /** Format: uuid */
            id: string;
            /** Format: int32 */
            position: number;
            quality: string;
            /** Format: int32 */
            quantity: number;
            /** @description The quote JSON the client saved with the line */
            quote: {
                [key: string]: unknown;
            };
            /** Format: int64 */
            sizeBytes: number;
            /** Format: date-time */
            updatedAt: string;
        };
        CartRequest: {
            items: components["schemas"]["CartItemRequest"][];
        };
        CartResponse: {
            items: components["schemas"]["CartItemResponse"][];
        };
        ColorOption: {
            code: string;
            hex: string;
            label: string;
            /** Format: double */
            pricePerKgChf: number;
        };
        Configured: {
            lengthFactor: {
                [key: string]: number;
            };
            /** Format: double */
            plateOverheadSeconds: number;
            timeFactor: {
                [key: string]: number;
            };
        };
        CustomerDetails: {
            city: string;
            country: string;
            /** Format: email */
            email: string;
            name: string;
            postalCode: string;
            street: string;
        };
        FilamentOption: {
            code: string;
            colors: components["schemas"]["ColorOption"][];
            label: string;
            profileName: string;
        };
        LoginLinkRequest: {
            /** Format: email */
            email: string;
        };
        OrderItemRequest: {
            color?: string | null;
            filament: string;
            fileName?: string | null;
            modelId: string;
            quality: string;
            /** Format: int32 */
            quantity?: number;
        };
        OrderItemResponse: {
            color: components["schemas"]["ColorOption"];
            filament: string;
            /** @description Material of the whole line, all copies of this item */
            filamentGrams: number;
            fileName: string;
            /** @description unitPriceChf x quantity */
            lineTotalChf: number;
            /**
             * Format: int32
             * @description 1-based position on the order
             */
            position: number;
            /**
             * Format: int32
             * @description Print time of the whole line, all copies of this item
             */
            printTimeSeconds: number;
            quality: string;
            /** Format: int32 */
            quantity: number;
            unitPriceChf: number;
        };
        OrderRequest: {
            customer: components["schemas"]["CustomerDetails"];
            /** @description The items total the customer saw: the sum of the item quotes' totalPriceChf (unit price x quantity), setup fee and shipping excluded. Optional; when present and different from the recomputed items total the order is refused with 409 price-changed. */
            expectedTotalChf?: number | null;
            items: components["schemas"]["OrderItemRequest"][];
        };
        OrderResponse: {
            /** Format: date-time */
            createdAt: string;
            customerEmail: string;
            customerName: string;
            items: components["schemas"]["OrderItemResponse"][];
            orderNumber: string;
            /** Format: date-time */
            paidAt: string | null;
            paymentUrl: string | null;
            /** Format: date-time */
            quoteExpiresAt: string;
            /** @enum {string} */
            status: "NEW" | "PAID" | "IN_REVIEW" | "APPROVED" | "PRINTING" | "SHIPPED" | "CANCELLED";
            totals: components["schemas"]["OrderTotals"];
            vatNote: string | null;
        };
        OrderSettingsResponse: {
            currency: string;
            /** Format: int32 */
            quoteValidityDays: number;
            setupFeeChf: number;
            shippingFlatChf: number;
            shipToCountries: string[];
            vatEnabled: boolean;
            vatRate: number;
        };
        OrderTotals: {
            currency: string;
            itemsTotal: number;
            setupFee: number;
            shipping: number;
            total: number;
            vatAmount: number;
            vatRate: number;
        };
        PasswordLoginRequest: {
            /** Format: email */
            email: string;
            password: string;
        };
        PasswordRequest: {
            password: string;
        };
        QualityOption: {
            /** Format: int32 */
            baseLeadTimeDays: number;
            code: string;
            label: string;
            /** Format: double */
            layerHeightMm: number;
            profileName: string;
        };
        QuantityStats: {
            /** Format: int32 */
            n: number;
            perCopyRatio: components["schemas"]["CalibrationStats"];
            plateOverheadSeconds: components["schemas"]["CalibrationStats"];
        };
        QuoteOptions: {
            filaments: components["schemas"]["FilamentOption"][];
            /** Format: int32 */
            maxQuantity: number;
            qualities: components["schemas"]["QualityOption"][];
        };
        QuoteResponse: {
            boundingBoxMm: components["schemas"]["BoundingBox"];
            color: components["schemas"]["ColorOption"];
            currency: string;
            filament: string;
            /** Format: double */
            filamentGrams: number;
            /** Format: double */
            filamentLengthMm: number;
            fileName: string;
            /** Format: double */
            layerHeightMm: number;
            /** Format: int32 */
            leadTimeDays: number;
            /** Format: double */
            machineCostChf: number;
            machineProfile: string;
            /** @description Whether the mesh is watertight; null when the check was not possible */
            manifold: boolean | null;
            /** Format: double */
            materialCostChf: number;
            /** Format: int32 */
            plateCount: number;
            /** Format: double */
            printTimeSeconds: number;
            quality: string;
            /** Format: int32 */
            quantity: number;
            /** Format: double */
            totalFilamentGrams: number;
            /** Format: double */
            totalPriceChf: number;
            /** Format: double */
            totalPrintTimeSeconds: number;
            /** Format: int32 */
            triangleCount: number;
            /** Format: double */
            unitPriceChf: number;
            /**
             * Format: double
             * @description Price per piece the same model would cost at quantity 1; the quantity discount is 1 - unitPriceChf / unitPriceSingleChf
             */
            unitPriceSingleChf: number;
            /** @description Slicer warnings about the model, as the slicer printed them */
            warnings: string[];
        };
        SessionRequest: {
            token: string;
        };
        SliceCalibrationRow: {
            bbox: components["schemas"]["BoundingBox"];
            /** Format: int32 */
            copies: number;
            /** Format: int64 */
            durationMs: number;
            filament: string;
            /** Format: double */
            filamentGrams: number;
            /** Format: double */
            filamentLengthMm: number;
            /** Format: uuid */
            id: string;
            /** @description The manifold check of a single copy; null for batches and when the check failed */
            manifold: boolean | null;
            /** Format: date-time */
            measuredAt: string;
            modelName: string;
            modelSha256: string;
            /** Format: int64 */
            modelSizeBytes: number;
            orderNumber: string | null;
            /** Format: int32 */
            plates: number;
            /** Format: int32 */
            printSeconds: number;
            quality: string;
            slicerVersion: string | null;
            /** @enum {string} */
            source: "quote" | "order" | "manual";
            /** Format: int32 */
            triangleCount: number;
            /** Format: int32 */
            warningsCount: number;
        };
        StatusChange: {
            /** @enum {string} */
            status: "NEW" | "PAID" | "IN_REVIEW" | "APPROVED" | "PRINTING" | "SHIPPED" | "CANCELLED";
        };
        UploadedModel: {
            fileName: string;
            modelId: string;
            /** Format: int64 */
            sizeBytes: number;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    account: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["AccountResponse"];
                };
            };
        };
    };
    update: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AccountUpdateRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["AccountResponse"];
                };
            };
        };
    };
    deleteAccount: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    cart: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["CartResponse"];
                };
            };
        };
    };
    replace: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CartRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["CartResponse"];
                };
            };
        };
    };
    clear: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    registerModel: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["UploadedModel"];
                };
            };
        };
    };
    requestLoginLink: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LoginLinkRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    orders: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["OrderResponse"][];
                };
            };
        };
    };
    order: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orderNumber: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["OrderResponse"];
                };
            };
        };
    };
    setPassword: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PasswordRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    removePassword: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    openSession: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SessionRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["AccountResponse"];
                };
            };
        };
    };
    logout: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    openSessionWithPassword: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PasswordLoginRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["AccountResponse"];
                };
            };
        };
    };
    queue: {
        parameters: {
            query?: {
                limit?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["CalibrationQueueResponse"][];
                };
            };
        };
    };
    queueStoredModel: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                modelId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["CalibrationQueueResponse"];
                };
            };
        };
    };
    queueOrderItem: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orderNumber: string;
                position: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["CalibrationQueueResponse"];
                };
            };
        };
    };
    report: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["CalibrationReport"];
                };
            };
        };
    };
    rows: {
        parameters: {
            query?: {
                limit?: number;
                source?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["SliceCalibrationRow"][];
                };
            };
        };
    };
    rowsCsv: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/csv": string;
                };
            };
        };
    };
    runNow: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": {
                        [key: string]: unknown;
                    };
                };
            };
        };
    };
    list: {
        parameters: {
            query?: {
                limit?: number;
                status?: "NEW" | "PAID" | "IN_REVIEW" | "APPROVED" | "PRINTING" | "SHIPPED" | "CANCELLED";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["AdminOrderResponse"][];
                };
            };
        };
    };
    get: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orderNumber: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["AdminOrderResponse"];
                };
            };
        };
    };
    erase: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orderNumber: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["AdminOrderResponse"];
                };
            };
        };
    };
    model: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orderNumber: string;
                position: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": string;
                };
            };
        };
    };
    setStatus: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                orderNumber: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["StatusChange"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["AdminOrderResponse"];
                };
            };
        };
    };
    resetRateLimit: {
        parameters: {
            query?: {
                clientKey?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": {
                        [key: string]: unknown;
                    };
                };
            };
        };
    };
    upload: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: {
            content: {
                "multipart/form-data": {
                    /** Format: binary */
                    file: string;
                };
            };
        };
        responses: {
            /** @description Created */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["UploadedModel"];
                };
            };
        };
    };
    placeOrder: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["OrderRequest"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["OrderResponse"];
                };
            };
        };
    };
    settings: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["OrderSettingsResponse"];
                };
            };
        };
    };
    complete: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                sessionId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": {
                        [key: string]: string;
                    };
                };
            };
        };
    };
    quoteUpload: {
        parameters: {
            query?: {
                color?: string;
                filament?: string;
                modelId?: string;
                quality?: string;
                quantity?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: {
            content: {
                "multipart/form-data": {
                    /** Format: binary */
                    file: string;
                };
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["QuoteResponse"];
                };
            };
        };
    };
    options: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "*/*": components["schemas"]["QuoteOptions"];
                };
            };
        };
    };
}
