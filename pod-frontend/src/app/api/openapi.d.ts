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
    "/api/orders/{orderNumber}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["find"];
        put?: never;
        post?: never;
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
    "/api/quotes/sample": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["quoteSample"];
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
            setupFeeChf: number;
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
        BoundingBox: {
            /** Format: double */
            depthMm: number;
            /** Format: double */
            heightMm: number;
            /** Format: double */
            widthMm: number;
        };
        ColorOption: {
            code: string;
            hex: string;
            label: string;
            /** Format: double */
            pricePerKgChf: number;
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
            /** @description setupFeeChf + unitPriceChf x quantity */
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
            /** @description Charged once per item */
            setupFeeChf: number;
            unitPriceChf: number;
        };
        OrderRequest: {
            customer: components["schemas"]["CustomerDetails"];
            /** @description The items total the customer saw: the sum of the item quotes' totalPriceChf, shipping excluded. Optional; when present and different from the recomputed items total the order is refused with 409 price-changed. */
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
            shippingFlatChf: number;
            shipToCountries: string[];
            vatEnabled: boolean;
            vatRate: number;
        };
        OrderTotals: {
            currency: string;
            itemsTotal: number;
            shipping: number;
            total: number;
            vatAmount: number;
            vatRate: number;
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
            setupFeeChf: number;
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
            /** @description Slicer warnings about the model, as the slicer printed them */
            warnings: string[];
        };
        SessionRequest: {
            token: string;
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
    find: {
        parameters: {
            query: {
                email: string;
            };
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
    quoteSample: {
        parameters: {
            query: {
                color?: string;
                filament?: string;
                fileName: string;
                quality?: string;
                quantity?: number;
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
                    "*/*": components["schemas"]["QuoteResponse"];
                };
            };
        };
    };
}
